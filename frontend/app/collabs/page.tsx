'use client';
import { useState } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useMyCollaborations, usePendingCollaborations, useMyTracks } from '@/lib/hooks';
import { socialApi, Collaboration } from '@/lib/api';
import {
    Users,
    Handshake,
    CheckCircle2,
    Clock,
    XCircle,
    MessageCircle,
    BadgeCheck,
    Music2,
    X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import CollabChat from '@/components/CollabChat';

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop';

// Lets either collaborator attach a finished track from their own library to an
// accepted collaboration — it then shows up as that collab's track everywhere.
function AddSongModal({
    collab,
    onClose,
    onAdded,
}: {
    collab: Collaboration;
    onClose: () => void;
    onAdded: () => void;
}) {
    const { data: tracksData, loading: tracksLoading } = useMyTracks();
    const tracks = tracksData?.items || [];
    const [trackId, setTrackId] = useState<number | undefined>(undefined);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!trackId || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await socialApi.addTrackToCollaboration(collab.id, trackId);
            onAdded();
            onClose();
        } catch (err) {
            console.error('Failed to add song to collaboration:', err);
            setError('Could not add that song — try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="card-premium p-8 w-full max-w-md shadow-3xl border-white/10"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-white tracking-tight">Add the Song</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
                        <X className="size-5" />
                    </button>
                </div>

                <p className="text-sm text-slate-400 mb-6">
                    Pick the finished track from your library. It&apos;ll show up as this collaboration&apos;s song for both of you.
                </p>

                {tracksLoading ? (
                    <p className="text-xs text-slate-500 font-medium">Loading your tracks...</p>
                ) : tracks.length === 0 ? (
                    <div className="text-center space-y-3 py-4">
                        <p className="text-sm text-slate-400">You haven&apos;t uploaded any tracks yet.</p>
                        <Link
                            href="/upload"
                            className="inline-block px-5 py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                        >
                            Upload a Release
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <select
                            value={trackId || ''}
                            onChange={(e) => setTrackId(e.target.value ? Number(e.target.value) : undefined)}
                            className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-4 text-xs font-bold text-white focus:outline-none focus:border-primary/50 appearance-none transition-colors"
                        >
                            <option value="" className="bg-[#0A0A0B]">Choose a track...</option>
                            {tracks.map((track) => (
                                <option key={track.id} value={track.id} className="bg-[#0A0A0B]">
                                    {track.title}
                                </option>
                            ))}
                        </select>

                        {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

                        <button
                            onClick={handleSubmit}
                            disabled={!trackId || submitting}
                            className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-all active:scale-98 disabled:opacity-30 disabled:grayscale cursor-pointer shadow-xl shadow-primary/20"
                        >
                            {submitting ? 'Adding...' : 'Add to Collaboration'}
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

const COLLAB_STATUS_STYLE: Record<string, string> = {
    pending: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    accepted: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    completed: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function CollabsPage() {
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const { data: myCollabs, loading: mineLoading, refetch: refetchMine } = useMyCollaborations();
    const { data: pendingCollabs, loading: pendingLoading, refetch: refetchPending } = usePendingCollaborations();
    const [respondingId, setRespondingId] = useState<number | null>(null);
    const [activeChat, setActiveChat] = useState<Collaboration | null>(null);
    const [addSongTarget, setAddSongTarget] = useState<Collaboration | null>(null);

    const loading = authLoading || mineLoading || pendingLoading;

    const handleRespond = async (collabId: number, status: 'accepted' | 'rejected') => {
        setRespondingId(collabId);
        try {
            await socialApi.respondToCollaboration(collabId, status);
            refetchPending();
            refetchMine();
        } catch (err) {
            console.error('Failed to respond to collaboration:', err);
        } finally {
            setRespondingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="size-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-slate-500 font-medium animate-pulse">Loading your collaborations...</p>
                </div>
            </div>
        );
    }

    const pending = pendingCollabs?.items || [];
    const mine = myCollabs?.items || [];

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

    const otherArtist = (collab: Collaboration) =>
        (artist && collab.initiator?.id === artist.id ? collab.collaborator : collab.initiator);

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-[1200px] mx-auto space-y-12 pb-32"
        >
            <motion.header variants={item} className="space-y-1">
                <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Artist Network</p>
                <h1 className="text-4xl font-black tracking-tight text-white">Collabs</h1>
                <p className="text-slate-500 font-medium">
                    Requests, accepted collaborations, and chat with the artists you're working with.
                </p>
            </motion.header>

            {/* Incoming collab requests */}
            <motion.div variants={item} className="space-y-4">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Handshake className="size-5 text-secondary" />
                    Incoming Requests
                </h2>
                {pending.length === 0 ? (
                    <div className="card-premium p-8 text-center border-dashed border-2 border-white/5">
                        <p className="text-sm text-slate-500 font-medium">No pending collaboration requests.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {pending.map((collab) => (
                            <div key={collab.id} className="card-premium p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="size-11 rounded-full overflow-hidden border border-white/10 shrink-0">
                                        <img
                                            src={collab.initiator?.profile_picture || FALLBACK_AVATAR}
                                            alt={collab.initiator?.stage_name}
                                            className="size-full object-cover"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white font-bold text-sm flex items-center gap-1.5">
                                            {collab.initiator?.stage_name || 'An artist'}
                                            {collab.initiator?.is_verified && <BadgeCheck className="size-3.5 text-primary shrink-0" />}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5 max-w-lg truncate">
                                            {collab.message || 'Wants to collaborate with you.'}
                                            {collab.track_title && <span className="text-slate-500"> — on "{collab.track_title}"</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleRespond(collab.id, 'rejected')}
                                        disabled={respondingId === collab.id}
                                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all disabled:opacity-50"
                                    >
                                        Decline
                                    </button>
                                    <button
                                        onClick={() => handleRespond(collab.id, 'accepted')}
                                        disabled={respondingId === collab.id}
                                        className="px-5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                                    >
                                        {respondingId === collab.id ? 'Working...' : 'Accept'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* All collaborations */}
            <motion.div variants={item} className="space-y-4">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Users className="size-5 text-primary" />
                    Your Collaborations
                </h2>
                {mine.length === 0 ? (
                    <div className="card-premium p-14 flex flex-col items-center gap-4 text-center border-dashed border-2 border-white/5">
                        <Users className="size-10 text-slate-600" />
                        <h3 className="text-lg font-black text-white">No collaborations yet</h3>
                        <p className="text-sm text-slate-400 font-medium max-w-md">
                            Send a collab request from a snippet in the Jam Jar to get started.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {mine.map((collab) => {
                            const other = otherArtist(collab);
                            const canChat = collab.status === 'accepted' || collab.status === 'completed';
                            const canAddSong = collab.status === 'accepted' || collab.status === 'completed';
                            return (
                                <div key={collab.id} className="card-premium p-4 flex flex-col gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="size-10 rounded-full overflow-hidden border border-white/10 shrink-0">
                                            <img src={other?.profile_picture || FALLBACK_AVATAR} alt={other?.stage_name} className="size-full object-cover" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                                                {other?.stage_name || 'Unknown artist'}
                                                {other?.is_verified && <BadgeCheck className="size-3.5 text-primary shrink-0" />}
                                            </p>
                                            {collab.track_title ? (
                                                <p className="text-[10px] font-black text-primary/80 uppercase tracking-widest truncate mt-0.5 flex items-center gap-1">
                                                    <Music2 className="size-3" />
                                                    {collab.track_title}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate mt-0.5">
                                                    No song attached yet
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className={cn(
                                            'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shrink-0',
                                            COLLAB_STATUS_STYLE[collab.status] || COLLAB_STATUS_STYLE.pending
                                        )}>
                                            {collab.status === 'completed' && <CheckCircle2 className="size-3" />}
                                            {collab.status === 'accepted' && <Handshake className="size-3" />}
                                            {collab.status === 'pending' && <Clock className="size-3" />}
                                            {collab.status === 'rejected' && <XCircle className="size-3" />}
                                            {collab.status}
                                        </span>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {canAddSong && (
                                                <button
                                                    onClick={() => setAddSongTarget(collab)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
                                                >
                                                    <Music2 className="size-3.5" />
                                                    {collab.track_title ? 'Change Song' : 'Add Song'}
                                                </button>
                                            )}
                                            {canChat && (
                                                <button
                                                    onClick={() => setActiveChat(collab)}
                                                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                                                >
                                                    <MessageCircle className="size-3.5" />
                                                    Chat
                                                    {collab.unread_count > 0 && (
                                                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-secondary rounded-full text-[9px] font-black text-white">
                                                            {collab.unread_count > 9 ? '9+' : collab.unread_count}
                                                        </span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {activeChat && (
                <CollabChat
                    collaborationId={activeChat.id}
                    otherArtistName={otherArtist(activeChat)?.stage_name || 'Artist'}
                    onClose={() => { setActiveChat(null); refetchMine(); }}
                />
            )}

            {addSongTarget && (
                <AddSongModal
                    collab={addSongTarget}
                    onClose={() => setAddSongTarget(null)}
                    onAdded={refetchMine}
                />
            )}
        </motion.div>
    );
}
