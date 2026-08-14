'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useRequireAuth } from '@/lib/auth';
import { useMyTracks, formatNumber, formatDuration } from '@/lib/hooks';
import { usePlayer } from '@/lib/playerStore';
import { tracksApi, ApiError, Track } from '@/lib/api';
import {
    Plus,
    Play,
    Pause,
    ChevronRight,
    Music as MusicIcon,
    Disc,
    Upload,
    Filter,
    Mic2,
    ListMusic,
    MoreVertical,
    EyeOff,
    Trash2,
    Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DistributionModal } from '@/components/DistributionModal';

export default function MusicLibrary() {
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const { data: tracks, loading: tracksLoading, refetch: refetchTracks } = useMyTracks();
    const { playTracks, currentTrack, isPlaying, toggle } = usePlayer();
    const router = useRouter();

    const [distributionTrack, setDistributionTrack] = useState<{id: number, title: string} | null>(null);
    const [menuOpenFor, setMenuOpenFor] = useState<number | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ track: Track; type: 'unpublish' | 'delete' } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [platformResults, setPlatformResults] = useState<{ platform: string; success: boolean; error: string | null }[] | null>(null);
    // Set either the instant we know client-side (is_public already false —
    // no need to even call the API to say "already unpublished") or once the
    // API tells us what actually happened. Drives which message/buttons the
    // modal shows — null means "still asking, nothing has happened yet".
    const [outcome, setOutcome] = useState<'unpublished' | 'already_unpublished' | 'not_published' | null>(null);

    const openUnpublishConfirm = (track: Track) => {
        setConfirmAction({ track, type: 'unpublish' });
        // Already known without asking the server — skip straight to the
        // informational state instead of offering a pointless confirm step.
        setOutcome(track.is_public ? null : 'already_unpublished');
    };

    const handleConfirmAction = async () => {
        if (!confirmAction) return;
        setActionLoading(true);
        setActionError(null);
        setPlatformResults(null);
        try {
            if (confirmAction.type === 'delete') {
                await tracksApi.deleteTrack(confirmAction.track.id);
                setConfirmAction(null);
            } else {
                const result = await tracksApi.unpublishTrack(confirmAction.track.id);
                setPlatformResults(result.platforms);
                setOutcome(result.outcome);
                // Only auto-close if it was real, fully-successful takedown work —
                // otherwise leave the dialog up showing what needs attention.
                if (result.outcome === 'unpublished' && result.platforms.every(p => p.success)) {
                    setConfirmAction(null);
                }
            }
            refetchTracks();
        } catch (err) {
            setActionError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const closeConfirm = () => {
        setConfirmAction(null);
        setActionError(null);
        setPlatformResults(null);
        setOutcome(null);
    };

    const loading = authLoading || tracksLoading;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="size-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-slate-500 font-medium animate-pulse">Scanning your library...</p>
                </div>
            </div>
        );
    }

    const trackItems = tracks?.items || [];
    const getAvatar = (i: number) => `https://images.unsplash.com/photo-${[
        '1614613535308-eb5fbd3d2c17',
        '1557672172-298e090bd0f1',
        '1493225457124-a1a2a5f5f9af',
        '1618005182384-a83a8bd57fbe',
        '1604871000636-074fa5117945'
    ][i % 5]}?q=80&w=500&auto=format&fit=crop`;

    const handlePlay = (track: any, index: number) => {
        if (!track.file_url) return;

        // Already the track loaded in the player — toggle pause/resume in
        // place instead of restarting it from 0 (playTracks always treats
        // its call as "start playing this," even for the current track).
        if (currentTrack?.id === track.id) {
            toggle();
            return;
        }

        const playerTracks = trackItems
            .filter((t: any) => t.file_url)
            .map((t: any, i: number) => ({
                id: t.id,
                title: t.title,
                artist: artist?.stage_name || 'Unknown Artist',
                url: t.file_url,
                coverUrl: t.cover_art_url || getAvatar(i),
                duration: t.duration
            }));

        const startIndex = playerTracks.findIndex((t: any) => t.id === track.id);
        playTracks(playerTracks, startIndex >= 0 ? startIndex : 0);
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-[1600px] mx-auto space-y-12"
        >
            <motion.header variants={item} className="flex justify-between items-end">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Artist Catalog</p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Music Library</h1>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => router.push('/upload')}
                        className="px-8 py-3 bg-primary text-white rounded-xl text-sm font-black flex items-center gap-2 hover:scale-105 transition-all active:scale-95 cursor-pointer shadow-xl shadow-primary/20"
                    >
                        <Upload className="size-4" />
                        New Release
                    </button>
                </div>
            </motion.header>

            <motion.div variants={item} className="flex items-center gap-3 overflow-x-auto pb-4 custom-scrollbar">
                {["All Releases", "Singles", "Albums", "EPs", "Drafts"].map((filter, i) => (
                    <button
                        key={filter}
                        className={cn(
                            "px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer",
                            i === 0
                                ? "bg-white text-black border-transparent shadow-lg shadow-white/5"
                                : "bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10"
                        )}
                    >
                        {filter}
                    </button>
                ))}
            </motion.div>

            <div className="flex flex-col gap-3 pb-20">
                {/* Upload Action Row */}
                <motion.div
                    variants={item}
                    onClick={() => router.push('/upload')}
                    className="card-premium p-4 flex items-center gap-6 group cursor-pointer border-dashed border-2 border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                    <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors shrink-0">
                        <Plus className="size-6" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold group-hover:text-primary transition-colors">Draft New Release</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Start uploading to your catalog</p>
                    </div>
                </motion.div>

                {/* Track List */}
                {trackItems.map((track, i) => {
                    const isProcessing = track.processing_status === 'pending' || track.processing_status === 'processing';
                    const isScheduled = track.release_date && new Date(track.release_date) > new Date();
                    const isRejected = track.approval_status === 'rejected';
                    const awaitingApproval = track.approval_status === 'pending' || track.approval_status === 'under_review';

                    const statusText = isProcessing ? 'AI Analyzing...'
                        : isRejected ? 'Rejected'
                        : isScheduled ? `Scheduled ${new Date(track.release_date!).toLocaleDateString()}`
                        : awaitingApproval ? 'Awaiting Approval'
                        : 'Ready to Distribute';
                    const statusStyle = isProcessing
                        ? 'text-primary bg-primary/10 border-primary/20 animate-pulse'
                        : isRejected
                        ? 'text-red-400 bg-red-400/10 border-red-400/20'
                        : isScheduled || awaitingApproval
                        ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                        : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';

                    return (
                        <motion.div
                            key={track.id}
                            variants={item}
                            onClick={() => handlePlay(track, i)}
                            className="card-premium p-3 pr-6 flex items-center justify-between group hover:border-white/20 transition-all cursor-pointer bg-[#050505] hover:bg-white/[0.02]"
                        >
                            <div className="flex items-center gap-5">
                                {/* Cover Art */}
                                <div className="relative size-14 rounded-xl overflow-hidden shrink-0 shadow-lg">
                                    <img src={track.cover_art_url || getAvatar(i)} className="size-full object-cover transition-transform group-hover:scale-110" />
                                    <div className={cn(
                                        "absolute inset-0 bg-black/40 transition-all flex items-center justify-center backdrop-blur-sm",
                                        currentTrack?.id === track.id && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                    )}>
                                        <div className="size-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                                            {currentTrack?.id === track.id && isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current ml-0.5" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Track Info */}
                                <div>
                                    <h3 className="text-white font-bold group-hover:text-primary transition-colors text-sm">{track.title}</h3>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                            <Mic2 className="size-3" />
                                            {artist?.stage_name || 'Verified Artist'}
                                        </div>
                                        <div className="w-1 h-1 rounded-full bg-white/10" />
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {track.genre || 'Single'}
                                        </div>
                                        {track.bpm && (
                                            <>
                                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                    {track.bpm} BPM
                                                </div>
                                            </>
                                        )}
                                        {track.ai_analysis?.hit_score && (
                                            <>
                                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                                <div className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest">
                                                    ✦ {Math.round(track.ai_analysis.hit_score)}% Hit
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {isRejected && track.approval_notes && (
                                        <p className="text-[10px] text-red-300/80 font-medium mt-1.5 max-w-md">
                                            Reason: {track.approval_notes}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Status & Actions */}
                            <div className="flex items-center gap-8">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border", statusStyle)}>
                                    {statusText}
                                </span>
                                
                                <span className="text-[10px] w-12 text-right font-black text-slate-500 font-mono tracking-wider tabular-nums">
                                    {formatDuration(track.duration || 0)}
                                </span>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDistributionTrack({ id: track.id, title: track.title });
                                    }}
                                    className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-primary text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all opacity-0 group-hover:opacity-100"
                                >
                                    Distribute
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/tracks/${track.id}`);
                                    }}
                                    title="View track details"
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all"
                                >
                                    <ChevronRight className="size-4" />
                                </button>

                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenFor(menuOpenFor === track.id ? null : track.id);
                                        }}
                                        title="More actions"
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all"
                                    >
                                        <MoreVertical className="size-4" />
                                    </button>

                                    <AnimatePresence>
                                        {menuOpenFor === track.id && (
                                            <>
                                                {/* Click-away overlay */}
                                                <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMenuOpenFor(null);
                                                    }}
                                                />
                                                <motion.div
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#0d0d0d] border border-white/10 shadow-2xl z-50 overflow-hidden"
                                                >
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMenuOpenFor(null);
                                                            openUnpublishConfirm(track);
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-2.5 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                                                    >
                                                        <EyeOff className="size-3.5" />
                                                        Unpublish
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMenuOpenFor(null);
                                                            setConfirmAction({ track, type: 'delete' });
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors text-left border-t border-white/5"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                        Delete Permanently
                                                    </button>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {distributionTrack && (
                <DistributionModal
                    isOpen={!!distributionTrack}
                    onClose={() => setDistributionTrack(null)}
                    trackId={distributionTrack.id}
                    trackTitle={distributionTrack.title}
                />
            )}

            <AnimatePresence>
                {confirmAction && (
                    <ConfirmActionModal
                        track={confirmAction.track}
                        actionType={confirmAction.type}
                        loading={actionLoading}
                        error={actionError}
                        platformResults={platformResults}
                        outcome={outcome}
                        onConfirm={handleConfirmAction}
                        onCancel={closeConfirm}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

const OUTCOME_COPY: Record<'unpublished' | 'already_unpublished' | 'not_published', { title: string; message: string }> = {
    unpublished: { title: 'Unpublished', message: 'This track has been unpublished.' },
    already_unpublished: { title: 'Already Unpublished', message: "This track is already unpublished — there's nothing to do." },
    not_published: { title: 'Not Published', message: "This track isn't live on any platform yet, so there's nothing to unpublish." },
};

function ConfirmActionModal({
    track, actionType, loading, error, platformResults, outcome, onConfirm, onCancel,
}: {
    track: Track;
    actionType: 'unpublish' | 'delete';
    loading: boolean;
    error: string | null;
    platformResults: { platform: string; success: boolean; error: string | null }[] | null;
    outcome: 'unpublished' | 'already_unpublished' | 'not_published' | null;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const isDelete = actionType === 'delete';
    const failedPlatforms = platformResults?.filter(p => !p.success) ?? [];
    // Once we know the outcome (client-side pre-check, or the API told us),
    // this is purely informational — no destructive action left to confirm.
    const isInfoOnly = outcome !== null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onCancel}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "size-10 rounded-full flex items-center justify-center shrink-0",
                        isInfoOnly
                            ? outcome === 'unpublished' ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                            : isDelete ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                    )}>
                        {isDelete && !isInfoOnly ? <Trash2 className="size-5" /> : <EyeOff className="size-5" />}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-white font-black text-lg">
                            {isInfoOnly ? OUTCOME_COPY[outcome].title : isDelete ? 'Delete Track' : 'Unpublish Track'}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">{track.title}</p>
                    </div>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">
                    {isInfoOnly
                        ? OUTCOME_COPY[outcome].message
                        : isDelete
                            ? "Permanently deletes this track — its audio, cover art, and any live platform listing — and cannot be undone. Blocked automatically if it's already earned money, to protect your balance."
                            : "Takes the track down (privately, reversibly) from any platform it's live on and hides it from your public profile. Analytics and earnings history are kept."}
                </p>

                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-200">
                        {error}
                    </div>
                )}

                {failedPlatforms.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                        {failedPlatforms.map(p => (
                            <p key={p.platform} className="text-xs text-amber-200">
                                <span className="capitalize font-bold">{p.platform}:</span> {p.error}
                            </p>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        {isInfoOnly || failedPlatforms.length > 0 ? 'Close' : 'Cancel'}
                    </button>
                    {!isInfoOnly && (
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50",
                                isDelete ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"
                            )}
                        >
                            {loading && <Loader2 className="size-3.5 animate-spin" />}
                            {loading ? 'Working...' : failedPlatforms.length > 0 ? 'Retry' : isDelete ? 'Delete Permanently' : 'Unpublish'}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
