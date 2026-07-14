'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, CheckCircle2, XCircle, RefreshCw, Zap } from 'lucide-react';
import { integrationsApi, IntegrationsOverview, PlatformStatus } from '@/lib/api';
import PlatformCard from '@/components/PlatformCard';
import SpotifyAnalyticsPanel from '@/components/SpotifyAnalyticsPanel';

// ─── Category tab labels ─────────────────────────────────────────────────────
const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'music', label: 'Music' },
  { id: 'video', label: 'Video' },
  { id: 'social', label: 'Social' },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [overview, setOverview] = useState<IntegrationsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ── Handle OAuth callback params ────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const platforms = ['youtube', 'spotify'];
    for (const p of platforms) {
      const result = params.get(p);
      if (result === 'success') {
        setNotification({ type: 'success', message: `${capitalize(p)} connected successfully!` });
        window.history.replaceState({}, '', window.location.pathname);
        break;
      } else if (result === 'error') {
        const msg = params.get('message') || 'unknown_error';
        const readable: Record<string, string> = {
          no_channel_found: `No ${capitalize(p)} channel found for that account.`,
          token_exchange_failed: 'Token exchange failed. Please try again.',
          invalid_state: 'OAuth state mismatch — please try again.',
        };
        setNotification({ type: 'error', message: readable[msg] || `Failed to connect ${capitalize(p)}.` });
        window.history.replaceState({}, '', window.location.pathname);
        break;
      }
    }
  }, []);

  // ── Auto-dismiss notification ────────────────────────────────────────────────
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(t);
  }, [notification]);

  // ── Fetch data ────────────────────────────────────────────────────────────────
  const fetchOverview = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await integrationsApi.getAll();
      setOverview(data);
    } catch {
      // silently fail — cards show their own empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // ── Filter by category ────────────────────────────────────────────────────────
  const filtered: PlatformStatus[] = overview
    ? activeCategory === 'all'
      ? overview.platforms
      : overview.platforms.filter((p) => p.category === activeCategory)
    : [];

  // ── Animation variants ────────────────────────────────────────────────────────
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };

  return (
    <div className="p-8 lg:p-12 max-w-5xl mx-auto space-y-10">

      {/* ── Toast Notification ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl max-w-sm ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}
          >
            {notification.type === 'success'
              ? <CheckCircle2 className="size-5 shrink-0" />
              : <XCircle className="size-5 shrink-0" />
            }
            <p className="text-sm font-semibold">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 opacity-60 hover:opacity-100 transition-opacity text-sm"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Link2 className="size-5 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Integrations</h1>
          </div>
          <p className="text-slate-500 font-medium max-w-lg">
            Connect your streaming profiles and social accounts to unlock cross-platform analytics, revenue predictions, and growth insights.
          </p>
        </div>

        {/* Stats pill + refresh */}
        <div className="flex items-center gap-3">
          {overview && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
              <Zap className="size-3.5 text-primary" />
              <span className="text-xs font-black text-white">
                {overview.connected_count}
                <span className="text-slate-500 font-medium"> / {overview.total_available} connected</span>
              </span>
            </div>
          )}
          <button
            id="refresh-integrations"
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="size-9 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Category Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            id={`tab-${cat.id}`}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeCategory === cat.id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/8'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Platform Grid ───────────────────────────────────────────────────────── */}
      {loading ? (
        // Skeleton grid
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-white/5" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 bg-white/5 rounded" />
                  <div className="h-3 w-40 bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-10 w-full bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {filtered.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                onConnected={() => fetchOverview(true)}
                onDisconnected={() => fetchOverview(true)}
              />
            ))}

            {filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full text-center py-16 text-slate-600"
              >
                <Link2 className="size-10 mx-auto mb-3 opacity-30" />
                <p className="font-bold">No platforms in this category yet.</p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Spotify Analytics Panel ──────────────────────────────────────────────── */}
      {overview?.platforms.find(p => p.id === 'spotify')?.connected && (
        <div className="mt-12 pt-8 border-t border-white/5">
          <SpotifyAnalyticsPanel />
        </div>
      )}

      {/* ── Footer note ─────────────────────────────────────────────────────────── */}
      <p className="text-center text-xs text-slate-700 font-medium pb-4">
        More integrations coming soon · Your tokens are encrypted and never shared
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
