'use client';

import { useEffect, useState, useCallback } from 'react';
import { youtubeApi, YouTubeConnectionStatus, YouTubeChannelStats } from '@/lib/api';

interface YouTubeConnectProps {
  className?: string;
  showStats?: boolean;
  onStatusChange?: (connected: boolean) => void;
}

export default function YouTubeConnect({ className = '', showStats = false, onStatusChange }: YouTubeConnectProps) {
  const [status, setStatus] = useState<YouTubeConnectionStatus | null>(null);
  const [stats, setStats] = useState<YouTubeChannelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const youtubeResult = params.get('youtube');
    
    if (youtubeResult === 'success') {
      // Refresh status after successful connection
      fetchStatus();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (youtubeResult === 'error') {
      const message = params.get('message');
      if (message === 'no_channel_found') {
        setError('No YouTube channel found for this Google account');
      } else {
        setError(message || 'Failed to connect YouTube');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const result = await youtubeApi.getStatus();
      setStatus(result);
      onStatusChange?.(result.connected);
      
      // Fetch stats if connected and showStats is enabled
      if (result.connected && showStats) {
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to fetch YouTube status:', err);
      setStatus({ connected: false, provider: 'youtube', channel_id: null, channel_title: null, thumbnail_url: null, expires_at: null });
    } finally {
      setLoading(false);
    }
  }, [onStatusChange, showStats]);

  const fetchStats = async (forceRefresh = false) => {
    try {
      setStatsLoading(true);
      const result = await youtubeApi.getStats(forceRefresh);
      setStats(result);
    } catch (err) {
      console.error('Failed to fetch YouTube stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const { auth_url } = await youtubeApi.getLoginUrl();
      // Redirect to Google OAuth
      window.location.href = auth_url;
    } catch (err) {
      console.error('Failed to get YouTube auth URL:', err);
      setError('Failed to initiate YouTube connection');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await youtubeApi.disconnect();
      setStatus({ connected: false, provider: 'youtube', channel_id: null, channel_title: null, thumbnail_url: null, expires_at: null });
      setStats(null);
      onStatusChange?.(false);
    } catch (err) {
      console.error('Failed to disconnect YouTube:', err);
      setError('Failed to disconnect YouTube');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await youtubeApi.refreshToken();
      await fetchStatus();
    } catch (err) {
      console.error('Failed to refresh YouTube token:', err);
      setError('Failed to refresh token. Please reconnect.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '0';
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toString();
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
          {/* YouTube Logo */}
          <div className="w-12 h-12 bg-[#FF0000] rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          
          <div>
            <h3 className="font-semibold text-white">YouTube</h3>
            {status?.connected ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">
                  {status.channel_title || 'Connected'}
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
                  className="px-4 py-2 bg-[#FF0000] text-white text-sm font-medium rounded-lg hover:bg-[#cc0000] transition-colors disabled:opacity-50"
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
              className="px-4 py-2 bg-[#FF0000] text-white text-sm font-medium rounded-lg hover:bg-[#cc0000] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                'Connecting...'
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Connect YouTube
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

      {/* Channel Stats */}
      {status?.connected && showStats && (
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500">Stats cached for 6 hours to save API quota</p>
            <button
              onClick={() => fetchStats(true)}
              disabled={statsLoading}
              className="text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <svg className={`w-3 h-3 ${statsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Now
            </button>
          </div>
          {statsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="h-6 w-16 bg-zinc-800 rounded animate-pulse mx-auto" />
                  <div className="h-3 w-12 bg-zinc-800 rounded animate-pulse mx-auto mt-2" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{formatNumber(stats.subscriber_count)}</p>
                <p className="text-xs text-zinc-500">Subscribers</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{formatNumber(stats.view_count)}</p>
                <p className="text-xs text-zinc-500">Total Views</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{formatNumber(stats.video_count)}</p>
                <p className="text-xs text-zinc-500">Videos</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center">Unable to load stats</p>
          )}
        </div>
      )}

      {status?.connected && !isExpired && !showStats && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500">
            Your YouTube channel is linked. We can display your subscriber count and video stats.
          </p>
        </div>
      )}
    </div>
  );
}
