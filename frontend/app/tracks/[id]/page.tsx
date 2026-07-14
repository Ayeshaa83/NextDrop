'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Play,
    Pause,
    Share2,
    BarChart3,
    Heart,
    Rocket,
    Music as MusicIcon,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Clock,
} from 'lucide-react';

import { useRequireAuth } from '@/lib/auth';
import { useTrack, useTrackAnalytics, formatDuration, formatNumber } from '@/lib/hooks';
import { usePlayer } from '@/lib/playerStore';
import { distributionApi, TrackDistributionStatus } from '@/lib/api';
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

export default function TrackDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const trackId = Number(params.id);

    const { artist, isLoading: authLoading } = useRequireAuth();
    const { data: track, loading: trackLoading, error: trackError } = useTrack(trackId);
    const { data: analytics } = useTrackAnalytics(trackId);
    const { playTracks, currentTrack, isPlaying } = usePlayer();

    const [distributions, setDistributions] = useState<TrackDistributionStatus[]>([]);
    const [showDistribution, setShowDistribution] = useState(false);

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

    const stats = [
        { label: 'Streams', value: formatNumber(analytics?.stream_count ?? 0), icon: BarChart3 },
        { label: 'Saves', value: formatNumber(analytics?.save_count ?? 0), icon: Heart },
        { label: 'Shares', value: formatNumber(analytics?.share_count ?? 0), icon: Share2 },
        {
            label: 'Hit Score',
            value: analytics?.hit_score != null
                ? `${Math.round(analytics.hit_score)}%`
                : track.ai_analysis?.hit_score != null
                    ? `${Math.round(track.ai_analysis.hit_score)}%`
                    : '—',
            icon: Rocket,
        },
    ];

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

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
                {stats.map((stat) => (
                    <div key={stat.label} className="card-premium p-6 space-y-2">
                        <div className="flex items-center gap-2 text-slate-500">
                            <stat.icon className="size-4" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <p className="text-3xl font-black text-white tabular-nums">{stat.value}</p>
                    </div>
                ))}
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
