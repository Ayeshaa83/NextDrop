'use client';

import { useEffect, useState, useCallback } from 'react';
import { spotifyApi, SpotifyConnectionStatus } from '@/lib/api';

interface SpotifyConnectProps {
  className?: string;
  onStatusChange?: (connected: boolean) => void;
}

export default function SpotifyConnect({ className = '', onStatusChange }: SpotifyConnectProps) {
  const [status, setStatus] = useState<SpotifyConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyResult = params.get('spotify');
    
    if (spotifyResult === 'success') {
      // Refresh status after successful connection
      fetchStatus();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (spotifyResult === 'error') {
      setError(params.get('message') || 'Failed to connect Spotify');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const result = await spotifyApi.getStatus();
      setStatus(result);
      onStatusChange?.(result.connected);
    } catch (err) {
      console.error('Failed to fetch Spotify status:', err);
      setStatus({ connected: false, provider: 'spotify', display_name: null, profile_image_url: null, provider_user_id: null, expires_at: null });
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const { auth_url } = await spotifyApi.getLoginUrl();
      // Redirect to Spotify OAuth
      window.location.href = auth_url;
    } catch (err) {
      console.error('Failed to get Spotify auth URL:', err);
      setError('Failed to initiate Spotify connection');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await spotifyApi.disconnect();
      setStatus({ connected: false, provider: 'spotify', display_name: null, profile_image_url: null, provider_user_id: null, expires_at: null });
      onStatusChange?.(false);
    } catch (err) {
      console.error('Failed to disconnect Spotify:', err);
      setError('Failed to disconnect Spotify');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await spotifyApi.refreshToken();
      await fetchStatus();
    } catch (err) {
      console.error('Failed to refresh Spotify token:', err);
      setError('Failed to refresh token. Please reconnect.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-zinc-900 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-800 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
            <div className="h-3 w-32 bg-zinc-800 rounded animate-pulse mt-2" />
          </div>
        </div>
      </div>
    );
  }

  const isExpired = status?.expires_at && new Date(status.expires_at) < new Date();

  return (
    <div className={`bg-zinc-900 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Spotify Logo */}
          <div className="w-12 h-12 bg-[#1DB954] rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
          
          <div>
            <h3 className="font-semibold text-white">Spotify</h3>
            {status?.connected ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">
                  Connected as {status.display_name || 'Unknown'}
                </span>
                {isExpired && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                    Expired
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Not connected</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status?.connected ? (
            <>
              {isExpired && (
                <button
                  onClick={handleRefresh}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1DB954] text-black text-sm font-medium rounded-lg hover:bg-[#1ed760] transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              )}
              <button
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={actionLoading}
              className="px-4 py-2 bg-[#1DB954] text-black text-sm font-medium rounded-lg hover:bg-[#1ed760] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                'Connecting...'
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Connect Spotify
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {status?.connected && !isExpired && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500">
            Your Spotify account is linked. We can access your listening stats to enhance your profile.
          </p>
        </div>
      )}
    </div>
  );
}
