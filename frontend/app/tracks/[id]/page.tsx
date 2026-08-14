'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Play,
    Pause,
    Rocket,
    Music as MusicIcon,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Clock,
    Sparkles,
    Gauge,
    Music2,
    Waves,
    Hash,
    Check,
    RefreshCw,
    Youtube,
    Eye,
    ThumbsUp,
    MessageCircle,
    TrendingUp,
    Lock,
} from 'lucide-react';

import { useRequireAuth } from '@/lib/auth';
import { useTrack, useTrackAnalytics, formatDuration, formatNumber } from '@/lib/hooks';
import { usePlayer } from '@/lib/playerStore';
import { analyticsApi, distributionApi, TrackDistributionStatus } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DistributionModal } from '@/components/DistributionModal';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=500&auto=format&fit=crop';

const STATUS_STYLES: Record<string, string> = {
    live: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    pending: 'text-primary bg-primary/10 border-primary/20',
    processing: 'text-primary bg-primary/10 border-primary/20',
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
    removed: 'text-slate-400 bg-white/5 border-white/10',
};

// Auto-refresh only kicks in once analytics are this stale, so opening the
// page repeatedly doesn't hammer YouTube's API on every visit.
const AUTO_REFRESH_STALE_MS = 15 * 60 * 1000;

function timeAgo(dateStr: string): string {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function TrackDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const trackId = Number(params.id);

    const { artist, isLoading: authLoading } = useRequireAuth();
    const { data: track, loading: trackLoading, error: trackError } = useTrack(trackId);
    const { data: analytics, refetch: refetchAnalytics } = useTrackAnalytics(trackId);
    const { playTracks, currentTrack, isPlaying, toggle } = usePlayer();

    const [distributions, setDistributions] = useState<TrackDistributionStatus[]>([]);
    const [showDistribution, setShowDistribution] = useState(false);
    const [isrcCopied, setIsrcCopied] = useState(false);
    const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);
    const hasAutoRefreshed = useRef(false);

    const hasLiveDistribution = distributions.some((d) => d.status === 'live');

    const handleRefreshAnalytics = async () => {
        if (refreshingAnalytics) return;
        setRefreshingAnalytics(true);
        try {
            await analyticsApi.refreshPlatforms(trackId);
            await refetchAnalytics();
        } catch {
            // Refresh failing (e.g. token expired, platform API hiccup) isn't
            // worth a hard error state — the stats just stay as they were.
        } finally {
            setRefreshingAnalytics(false);
        }
    };

    // Auto-refresh once per page visit, but only when there's actually a live
    // distribution to pull stats from, and only if what's shown is stale —
    // otherwise every page open would hit YouTube's API for no reason.
    useEffect(() => {
        if (hasAutoRefreshed.current || !hasLiveDistribution) return;
        const staleOrMissing =
            !analytics?.last_updated ||
            Date.now() - new Date(analytics.last_updated).getTime() > AUTO_REFRESH_STALE_MS;
        if (staleOrMissing) {
            hasAutoRefreshed.current = true;
            handleRefreshAnalytics();
        }
    }, [hasLiveDistribution, analytics?.last_updated]);

    const handleCopyIsrc = async (isrc: string) => {
        try {
            await navigator.clipboard.writeText(isrc);
            setIsrcCopied(true);
            setTimeout(() => setIsrcCopied(false), 2000);
        } catch {
            // Clipboard unavailable — ignore
        }
    };

    useEffect(() => {
        if (!trackId) return;
        distributionApi
            .getTrackDistributions(trackId)
            .then(setDistributions)
            .catch(() => setDistributions([]));
    }, [trackId, showDistribution]);

    const loading = authLoading || trackLoading;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="size-10 border-2 border-primary border-t-transparent rounded-full"
                />
            </div>
        );
    }

    if (trackError || !track) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] gap-4">
                <AlertCircle className="size-10 text-red-400" />
                <p className="text-slate-400 font-medium">Track not found or you don&apos;t have access to it.</p>
                <button
                    onClick={() => router.push('/music')}
                    className="px-6 py-2.5 rounded-xl bg-white/5 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                    Back to Library
                </button>
            </div>
        );
    }

    const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying;

    const handlePlay = () => {
        if (!track.file_url) return;

        // Same track already loaded — toggle pause/resume instead of
        // restarting it from 0.
        if (currentTrack?.id === track.id) {
            toggle();
            return;
        }

        playTracks(
            [
                {
                    id: track.id,
                    title: track.title,
                    artist: artist?.stage_name || 'Unknown Artist',
                    url: track.file_url,
                    coverUrl: track.cover_art_url || FALLBACK_COVER,
                    duration: track.duration,
                },
            ],
            0
        );
    };

    const hitScoreValue = analytics?.hit_score != null
        ? `${Math.round(analytics.hit_score)}%`
        : track.ai_analysis?.hit_score != null
            ? `${Math.round(track.ai_analysis.hit_score)}%`
            : '—';

    const youtubeLive = distributions.some((d) => d.platform === 'youtube' && d.status === 'live');
    const spotifyLive = distributions.some((d) => d.platform === 'spotify' && d.status === 'live');

    return (
        <div className="p-8 lg:p-12 max-w-[1200px] mx-auto space-y-10 pb-32">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors mb-8"
                >
                    <ArrowLeft className="size-4" />
                    Back
                </button>

                {/* Hero */}
                <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
                    <div className="relative size-40 md:size-48 rounded-2xl overflow-hidden shrink-0 shadow-2xl">
                        <img src={track.cover_art_url || FALLBACK_COVER} className="size-full object-cover" alt={track.title} />
                    </div>
                    <div className="space-y-3 flex-1">
                        <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Track Details</p>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{track.title}</h1>
                        <div className="flex items-center gap-3 flex-wrap text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>{artist?.stage_name || 'You'}</span>
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                            <span>{track.genre || 'Single'}</span>
                            {track.bpm && (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-white/10" />
                                    <span>{track.bpm} BPM</span>
                                </>
                            )}
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                            <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {formatDuration(track.duration || 0)}
                            </span>
                            {track.isrc && (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-white/10" />
                                    <button
                                        onClick={() => handleCopyIsrc(track.isrc!)}
                                        title="Copy ISRC"
                                        className={cn(
                                            'flex items-center gap-1 transition-colors cursor-pointer normal-case tracking-normal font-mono',
                                            isrcCopied ? 'text-emerald-400' : 'hover:text-white'
                                        )}
                                    >
                                        {isrcCopied ? <Check className="size-3" /> : <Hash className="size-3" />}
                                        {isrcCopied ? 'Copied!' : track.isrc}
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={handlePlay}
                                disabled={!track.file_url}
                                className="px-8 py-3 bg-primary text-white rounded-xl text-sm font-black flex items-center gap-2 hover:scale-105 transition-all active:scale-95 disabled:opacity-40 disabled:hover:scale-100 shadow-xl shadow-primary/20"
                            >
                                {isCurrentlyPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
                                {isCurrentlyPlaying ? 'Pause' : 'Play'}
                            </button>
                            <button
                                onClick={() => setShowDistribution(true)}
                                className="px-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-black flex items-center gap-2 hover:bg-white/10 transition-all"
                            >
                                <Rocket className="size-4" />
                                Distribute
                            </button>
                        </div>
                    </div>
                </div>

                {track.approval_status === 'rejected' && (
                    <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                        <AlertCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-red-200">This track was not approved</p>
                            <p className="text-xs text-red-300/80 mt-1">
                                {track.approval_notes || 'No reason was provided. You can revise and re-upload it.'}
                            </p>
                        </div>
                    </div>
                )}
                {track.approval_status === 'pending' && (
                    <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                        <Clock className="size-4 text-amber-400 shrink-0" />
                        <p className="text-sm text-amber-200">Awaiting admin review before it can be distributed.</p>
                    </div>
                )}
            </motion.div>

            {/* Hit Score — AI-computed at upload time, unrelated to publish status */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="card-premium p-6 space-y-2 max-w-[200px]">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Rocket className="size-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Hit Score</span>
                    </div>
                    <p className="text-3xl font-black text-white tabular-nums">{hitScoreValue}</p>
                </div>
            </motion.div>

            {/* Platform analytics — kept separate per platform since YouTube and
                Spotify measure genuinely different things, and each is gated on
                that specific platform actually being live, not just "published
                somewhere". */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-3"
            >
                {hasLiveDistribution && (
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                            {analytics?.last_updated
                                ? `Updated ${timeAgo(analytics.last_updated)}`
                                : 'Not fetched yet'}
                        </span>
                        <button
                            onClick={handleRefreshAnalytics}
                            disabled={refreshingAnalytics}
                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={cn('size-3', refreshingAnalytics && 'animate-spin')} />
                            {refreshingAnalytics ? 'Refreshing...' : 'Refresh Analytics'}
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* YouTube */}
                    <div className="relative card-premium p-6 space-y-4 overflow-hidden">
                        <div className="flex items-center gap-2">
                            <Youtube className="size-4 text-[#FF0000]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">YouTube</span>
                        </div>
                        <div className={cn('grid grid-cols-3 gap-4', !youtubeLive && 'blur-sm select-none pointer-events-none')}>
                            {[
                                { label: 'Views', value: formatNumber(analytics?.youtube_views ?? 0), icon: Eye },
                                { label: 'Likes', value: formatNumber(analytics?.youtube_likes ?? 0), icon: ThumbsUp },
                                { label: 'Comments', value: formatNumber(analytics?.youtube_comments ?? 0), icon: MessageCircle },
                            ].map((stat) => (
                                <div key={stat.label} className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <stat.icon className="size-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">{stat.label}</span>
                                    </div>
                                    <p className="text-2xl font-black text-white tabular-nums">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                        {!youtubeLive && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <div className="px-4 py-2.5 rounded-xl bg-black/80 border border-white/10 backdrop-blur-sm flex items-center gap-2">
                                    <Lock className="size-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                        Publish to YouTube to view analytics
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Spotify */}
                    <div className="relative card-premium p-6 space-y-4 overflow-hidden">
                        <div className="flex items-center gap-2">
                            <Music2 className="size-4 text-[#1DB954]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Spotify</span>
                        </div>
                        <div className={cn('grid grid-cols-3 gap-4', !spotifyLive && 'blur-sm select-none pointer-events-none')}>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-slate-500">
                                    <TrendingUp className="size-3.5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Popularity</span>
                                </div>
                                <p className="text-2xl font-black text-white tabular-nums">
                                    {analytics?.spotify_popularity != null ? `${analytics.spotify_popularity}/100` : '—'}
                                </p>
                            </div>
                        </div>
                        {!spotifyLive && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 p-4">
                                <div className="px-4 py-2.5 rounded-xl bg-black/80 border border-white/10 backdrop-blur-sm flex flex-col items-center gap-1 text-center">
                                    <div className="flex items-center gap-2">
                                        <Lock className="size-3.5 text-slate-400 shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                            No Spotify listing linked
                                        </span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-medium normal-case">
                                        Direct publishing isn&apos;t available without a distributor partnership
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* AI Analysis — the Musicnn/XGBoost result saved at upload time, surfaced permanently */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-4"
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <h2 className="text-xl font-black text-white">AI Analysis</h2>
                </div>

                {track.ai_analysis?.features ? (
                    <div className="card-premium p-6 space-y-6">
                        {/* Genre + key + loudness badges */}
                        <div className="flex flex-wrap items-center gap-3">
                            {track.ai_analysis.predicted_genre && (
                                <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-primary/10 border border-primary/20 text-primary">
                                    {track.ai_analysis.predicted_genre}
                                    {track.ai_analysis.genre_confidence != null && (
                                        <span className="text-primary/60 font-normal">
                                            {' '}· {Math.round(track.ai_analysis.genre_confidence * 100)}% confidence
                                        </span>
                                    )}
                                </span>
                            )}
                            {typeof track.ai_analysis.features.key === 'string' && (
                                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1.5">
                                    <Music2 className="size-3" /> {track.ai_analysis.features.key}
                                </span>
                            )}
                            {typeof track.ai_analysis.features.loudness_db === 'number' && (
                                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1.5">
                                    <Waves className="size-3" /> {track.ai_analysis.features.loudness_db} dB
                                </span>
                            )}
                        </div>

                        {/* Feature meters */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {([
                                ['energy', 'Energy'],
                                ['danceability', 'Danceability'],
                                ['valence', 'Valence'],
                                ['acousticness', 'Acousticness'],
                                ['instrumentalness', 'Instrumentalness'],
                            ] as const).map(([key, label]) => {
                                const raw = track.ai_analysis?.features?.[key];
                                if (typeof raw !== 'number') return null;
                                const pct = Math.round(raw * 100);
                                return (
                                    <div key={key} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            <span>{label}</span>
                                            <span className="text-slate-300">{pct}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-[#00f2fe]/60"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Hit-score factors */}
                        {track.ai_analysis.hit_factors && Object.keys(track.ai_analysis.hit_factors).length > 0 && (
                            <div className="pt-2 border-t border-white/[0.04] space-y-2">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <Gauge className="size-3 text-primary" />
                                    Hit Score Factors
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(track.ai_analysis.hit_factors)
                                        .filter(([k]) => k !== 'model_version')
                                        .map(([k, v]) => (
                                            <span
                                                key={k}
                                                className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-white/[0.03] border border-white/[0.06] text-slate-300"
                                            >
                                                {k.replace(/_/g, ' ')}: {typeof v === 'number' ? v : String(v)}
                                            </span>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : track.processing_status === 'failed' ? (
                    <div className="card-premium p-8 flex flex-col items-center gap-3 text-center border-dashed border-2 border-red-500/10">
                        <AlertCircle className="size-8 text-red-400" />
                        <p className="text-sm text-red-300 font-medium">AI analysis failed for this track.</p>
                    </div>
                ) : (
                    <div className="card-premium p-8 flex flex-col items-center gap-3 text-center border-dashed border-2 border-white/5">
                        <Loader2 className="size-8 text-primary animate-spin" />
                        <p className="text-sm text-slate-400 font-medium">
                            Still analyzing this track&apos;s audio — check back in a moment.
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Distribution status */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
            >
                <h2 className="text-xl font-black text-white">Distribution Status</h2>
                {distributions.length === 0 ? (
                    <div className="card-premium p-8 flex flex-col items-center gap-3 text-center border-dashed border-2 border-white/5">
                        <MusicIcon className="size-8 text-slate-600" />
                        <p className="text-sm text-slate-400 font-medium">
                            This track hasn&apos;t been distributed to any platform yet.
                        </p>
                        <button
                            onClick={() => setShowDistribution(true)}
                            className="px-6 py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                        >
                            Distribute Now
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {distributions.map((dist) => (
                            <div key={dist.id} className="card-premium p-4 pr-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="size-11 rounded-xl bg-white/5 flex items-center justify-center">
                                        {dist.status === 'live' && <CheckCircle2 className="size-5 text-emerald-400" />}
                                        {(dist.status === 'pending' || dist.status === 'processing') && (
                                            <Loader2 className="size-5 text-primary animate-spin" />
                                        )}
                                        {(dist.status === 'failed' || dist.status === 'removed') && (
                                            <AlertCircle className="size-5 text-red-400" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-sm capitalize">{dist.platform}</h3>
                                        {dist.error_message && (
                                            <p className="text-[10px] text-red-300 mt-0.5 max-w-md truncate">{dist.error_message}</p>
                                        )}
                                        {dist.distributed_at && (
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                                                Live since {new Date(dist.distributed_at).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span
                                        className={cn(
                                            'text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border',
                                            STATUS_STYLES[dist.status] || STATUS_STYLES.removed
                                        )}
                                    >
                                        {dist.status}
                                    </span>
                                    {dist.platform_url && (
                                        <a
                                            href={dist.platform_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                        >
                                            <ExternalLink className="size-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {showDistribution && (
                <DistributionModal
                    isOpen={showDistribution}
                    onClose={() => setShowDistribution(false)}
                    trackId={track.id}
                    trackTitle={track.title}
                />
            )}
        </div>
    );
}
