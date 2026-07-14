'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Unlink, ExternalLink, AlertTriangle, Clock } from 'lucide-react';
import { PlatformStatus, integrationsApi } from '@/lib/api';

// ─── Platform SVG Icons ──────────────────────────────────────────────────────
// Each returns an inline SVG so we have no icon dependency issues.

function PlatformIcon({ id, className = 'w-7 h-7' }: { id: string; className?: string }) {
  switch (id) {
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'spotify':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      );
    case 'apple_music':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208a4.93 4.93 0 0 0-.35 1.49c-.052.51-.07 1.022-.078 1.535-.007.52 0 1.04 0 1.56v9.4c0 .52-.005 1.04 0 1.56.008.512.026 1.024.078 1.535.072.71.26 1.39.613 2.01.648 1.14 1.64 1.87 2.94 2.18.47.11.95.17 1.43.19.54.022 1.08.03 1.62.03h9.48c.54 0 1.08-.008 1.62-.03.48-.02.96-.08 1.43-.19 1.3-.31 2.29-1.04 2.94-2.18.352-.62.54-1.3.613-2.01.05-.51.07-1.023.077-1.535.006-.52 0-1.04 0-1.56V7.803c0-.52.007-1.04 0-1.56-.007-.04-.01-.08-.013-.12zM12 17.5c-3.038 0-5.5-2.46-5.5-5.5S8.962 6.5 12 6.5s5.5 2.46 5.5 5.5-2.462 5.5-5.5 5.5zm0-9.166A3.67 3.67 0 0 0 8.334 12 3.67 3.67 0 0 0 12 15.666 3.67 3.67 0 0 0 15.666 12 3.67 3.67 0 0 0 12 8.334zm5.712-3.38a1.32 1.32 0 1 1 0 2.64 1.32 1.32 0 0 1 0-2.64z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    case 'soundcloud':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M1.175 12.225c-.016 0-.032.01-.048.01A.464.464 0 0 1 .64 12c0-.254.207-.461.461-.461.012 0 .023.003.034.003C1.001 10.064 2.462 8.75 4.245 8.75c.16 0 .318.01.473.03C5.2 7.17 6.555 6 8.215 6c.82 0 1.57.29 2.155.765C10.985 4.93 12.65 3.75 14.595 3.75c2.58 0 4.67 2.09 4.67 4.67 0 .12-.005.24-.013.36.38-.1.78-.155 1.19-.155C22.37 8.625 24 10.255 24 12.27c0 1.795-1.29 3.285-3.01 3.575l.01.075a.464.464 0 0 1-.461.46.46.46 0 0 1-.461-.46v-.01H1.175v-.01a.464.464 0 0 1-.461-.46c0-.254.207-.461.461-.461z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case 'twitch':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PlatformCardProps {
  platform: PlatformStatus;
  onConnected: () => void;
  onDisconnected: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlatformCard({ platform, onConnected, onDisconnected }: PlatformCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!platform.login_endpoint) return;
    try {
      setLoading(true);
      setError(null);
      await integrationsApi.connect(platform.login_endpoint);
      // Page will redirect — no need to call onConnected here
    } catch {
      setError('Failed to start connection. Please try again.');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!platform.disconnect_endpoint) return;
    try {
      setLoading(true);
      setError(null);
      await integrationsApi.disconnect(platform.disconnect_endpoint);
      onDisconnected();
    } catch {
      setError('Failed to disconnect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isComingSoon = !platform.available;
  const isConnected = platform.connected;
  const isExpired = platform.token_expired;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${isComingSoon
          ? 'border-white/5 bg-white/[0.02] opacity-60'
          : isConnected
            ? 'border-white/10 bg-[#0a0a0b] shadow-lg'
            : 'border-white/5 bg-[#0a0a0b] hover:border-white/10 hover:shadow-lg'
        }`}
      style={isConnected ? { boxShadow: `0 0 30px ${platform.color}18` } : undefined}
    >
      {/* Connected glow stripe */}
      {isConnected && (
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, ${platform.color}, transparent)` }}
        />
      )}

      <div className="p-6 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Icon circle */}
            <div
              className="size-14 rounded-2xl flex items-center justify-center shrink-0 border"
              style={{
                background: `${platform.color}15`,
                borderColor: `${platform.color}25`,
                color: platform.color,
              }}
            >
              <PlatformIcon id={platform.id} className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-white">{platform.name}</h3>
                {isConnected && !isExpired && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="size-2.5" />
                    Connected
                  </span>
                )}
                {isConnected && isExpired && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <AlertTriangle className="size-2.5" />
                    Expired
                  </span>
                )}
                {isComingSoon && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-800 border border-white/5 text-slate-500">
                    <Clock className="size-2.5" />
                    Soon
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                {platform.description}
              </p>
            </div>
          </div>
        </div>

        {/* Connected info */}
        <AnimatePresence>
          {isConnected && platform.display_name && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/5"
            >
              {platform.profile_image_url && (
                <img
                  src={platform.profile_image_url}
                  alt={platform.display_name}
                  className="size-5 rounded-full object-cover"
                />
              )}
              <span className="text-xs font-bold text-slate-300">{platform.display_name}</span>
              <ExternalLink className="size-3 text-slate-500 ml-auto" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-red-400 flex items-center gap-1.5"
            >
              <AlertTriangle className="size-3 shrink-0" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Action button */}
        <div className="flex items-center gap-2 pt-1">
          {isComingSoon ? (
            <button
              disabled
              className="w-full py-2.5 rounded-xl bg-white/3 border border-white/5 text-xs font-black uppercase tracking-widest text-slate-600 cursor-not-allowed"
            >
              Coming Soon
            </button>
          ) : isConnected ? (
            <button
              id={`disconnect-${platform.id}`}
              onClick={handleDisconnect}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 text-xs font-black uppercase tracking-widest text-slate-400 transition-all disabled:opacity-50"
            >
              {loading
                ? <Loader2 className="size-3 animate-spin" />
                : <Unlink className="size-3" />
              }
              {loading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              id={`connect-${platform.id}`}
              onClick={handleConnect}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 hover:brightness-110 active:scale-95"
              style={{
                background: `${platform.color}18`,
                borderColor: `${platform.color}30`,
                color: platform.color,
              }}
            >
              {loading
                ? <Loader2 className="size-3 animate-spin" />
                : <PlatformIcon id={platform.id} className="size-3.5" />
              }
              {loading ? 'Connecting...' : `Connect ${platform.name}`}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
