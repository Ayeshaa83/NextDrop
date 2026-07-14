'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth';
import { useOpenVerseFeed, useMyCollaborations, usePendingCollaborations } from '@/lib/hooks';
import { feedApi, socialApi, SocialPost } from '@/lib/api';
import {
    Zap,
    Users,
    Plus,
    Music,
    Play,
    Handshake,
    CheckCircle2,
    Clock,
    Sparkles,
    Verified
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePlayer } from '@/lib/playerStore';

const FALLBACK_COVERS = [
    'photo-1557672172-298e090bd0f1', 'photo-1493225457124-a1a2a5f5f9af',
    'photo-1514525253161-7a46d19cd819', 'photo-1618005182384-a83a8bd57fbe',
    'photo-1511379938547-c1f69419868d', 'photo-1470225620880-dba8ba36b745',
];
const cover = (i: number) =>
    `https://images.unsplash.com/${FALLBACK_COVERS[i % FALLBACK_COVERS.length]}?q=80&w=500&auto=format&fit=crop`;

const COLLAB_STATUS_STYLE: Record<string, string> = {
    pending: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    accepted: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    completed: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
};

function VerseCard({ post, index }: { post: SocialPost; index: number }) {
    const { playTracks } = usePlayer();
    const [requestState, setRequestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    const handlePlay = () => {
        if (!post.track?.file_url) return;
        playTracks([{
            id: post.track.id,
            title: post.track.title,
            artist: post.artist.stage_name,
            url: post.track.file_url,
            duration: post.track.duration,
        }], 0);
    };

    const handleRequest = async () => {
        if (requestState === 'sending' || requestState === 'sent') return;
        setRequestState('sending');
        try {
            await feedApi.sendCollabRequest(post.id, 'I want to jump on this open verse!');
            setRequestState('sent');
        } catch {
            setRequestState('error');
            setTimeout(() => setRequestState('idle'), 2500);
        }
    };

    return (
        <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="card-premium p-4 flex flex-col group hover:border-primary/40 transition-all duration-500"
        >
            <div className="relative aspect-square rounded-2xl overflow-hidden mb-5">
                <img src={cover(index)} className="size-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                {post.track?.file_url && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                            onClick={handlePlay}
                            className="size-12 rounded-full bg-white text-black flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                        >
                            <Play className="size-6 fill-current" />
                        </button>
                    </div>
                )}
                {post.track?.bpm && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-xl rounded-lg border border-white/10 text-[9px] font-black text-white uppercase tracking-widest">
                        {post.track.bpm} BPM
                    </div>
                )}
            </div>

            <div className="px-1 flex-1 flex flex-col">
                <h3 className="text-white font-bold group-hover:text-primary transition-colors truncate">
                    {post.track?.title || 'Open Verse'}
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                    By {post.artist.stage_name}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-3 line-clamp-2 flex-1">{post.content}</p>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <Sparkles className="size-3.5 text-secondary" />
                        {post.like_count} hypes
                    </div>
                    <button
                        onClick={handleRequest}
                        disabled={requestState === 'sending' || requestState === 'sent'}
                        className={cn(
                            'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer',
                            requestState === 'sent'
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                : requestState === 'error'
                                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                : 'bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary hover:text-black'
                        )}
                    >
                        {requestState === 'sent' ? 'Requested ✓'
                            : requestState === 'sending' ? 'Sending...'
                            : requestState === 'error' ? 'Retry'
                            : 'Join Verse'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

export default function OpenVerse() {
    const router = useRouter();
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const { data: verseFeed, loading: feedLoading } = useOpenVerseFeed();
    const { data: myCollabs, refetch: refetchMine } = useMyCollaborations();
    const { data: pendingCollabs, refetch: refetchPending } = usePendingCollaborations();
    const { playTracks } = usePlayer();
    const [respondingId, setRespondingId] = useState<number | null>(null);

    const loading = authLoading || feedLoading;

    const handleRespond = async (collabId: number) => {
        setRespondingId(collabId);
        try {
            await socialApi.respondToCollaboration(collabId, 'accepted');
            refetchPending();
            refetchMine();
        } catch (err) {
            console.error('Failed to accept collaboration:', err);
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
                    <p className="text-slate-500 font-medium animate-pulse">Syncing marketplace data...</p>
                </div>
            </div>
        );
    }

    const verses = verseFeed?.items || [];
    const featured = verses.find(v => v.track) || verses[0];
    const gridVerses = verses.filter(v => v.id !== featured?.id);
    const pending = pendingCollabs?.items || [];
    const mine = (myCollabs?.items || []).slice(0, 6);

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-[1400px] mx-auto space-y-12 pb-32"
        >
            <motion.header variants={item} className="flex justify-between items-end">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Marketplace</p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Open Verses</h1>
                </div>
                <motion.div variants={item} className="flex gap-4">
                    <button
                        onClick={() => router.push('/jamjar')}
                        className="px-8 py-3 bg-primary text-white rounded-xl text-sm font-black flex items-center gap-2 hover:scale-105 transition-all active:scale-95 cursor-pointer shadow-xl shadow-primary/20"
                    >
                        <Plus className="size-4" />
                        Host Collab
                    </button>
                </motion.div>
            </motion.header>

            {/* Featured Hero — latest open verse with audio */}
            {featured ? (
                <motion.div variants={item} className="group relative w-full h-[380px] rounded-[40px] overflow-hidden border border-white/5 hover:border-primary/40 transition-all duration-700 shadow-3xl">
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                        style={{ backgroundImage: `url(https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop)` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent" />

                    <div className="absolute inset-0 p-12 flex flex-col justify-end">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2">
                                <Zap className="size-3 fill-current" />
                                Latest Open Verse
                            </span>
                        </div>
                        <h2 className="text-5xl font-black text-white tracking-tighter mb-4 truncate">
                            {featured.track?.title || featured.content.slice(0, 60)}
                        </h2>
                        <div className="flex items-center gap-6 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full overflow-hidden bg-slate-800 border border-white/20">
                                    {featured.artist.profile_picture && (
                                        <img src={featured.artist.profile_picture} className="size-full object-cover" alt="" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white flex items-center gap-1.5">
                                        {featured.artist.stage_name}
                                        <Verified className="size-3.5 text-secondary fill-secondary/20" />
                                    </p>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hosting Artist</p>
                                </div>
                            </div>
                            {featured.track?.bpm && (
                                <>
                                    <div className="h-8 w-px bg-white/10" />
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BPM</p>
                                        <p className="text-xl font-black text-primary">{featured.track.bpm}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        {featured.track?.file_url && (
                            <div className="flex gap-4">
                                <button
                                    onClick={() => playTracks([{
                                        id: featured.track!.id,
                                        title: featured.track!.title,
                                        artist: featured.artist.stage_name,
                                        url: featured.track!.file_url,
                                        duration: featured.track!.duration,
                                    }], 0)}
                                    className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all active:scale-95 shadow-2xl flex items-center gap-3 cursor-pointer"
                                >
                                    <Play className="size-4 fill-current" />
                                    Play Verse
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            ) : (
                <motion.div variants={item} className="card-premium p-14 flex flex-col items-center gap-4 text-center border-dashed border-2 border-white/5">
                    <Music className="size-10 text-slate-600" />
                    <h2 className="text-xl font-black text-white">No open verses yet</h2>
                    <p className="text-sm text-slate-400 font-medium max-w-md">
                        Be the first: post a track snippet in Remix Mode from the Jam Jar and invite
                        other artists to jump on your verse.
                    </p>
                    <button
                        onClick={() => router.push('/jamjar')}
                        className="mt-2 px-8 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform"
                    >
                        Open Jam Jar
                    </button>
                </motion.div>
            )}

            {/* Grid of real open verses */}
            {gridVerses.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {gridVerses.map((post, i) => (
                        <VerseCard key={post.id} post={post} index={i} />
                    ))}
                </div>
            )}

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
                            <div key={collab.id} className="card-premium p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="size-11 rounded-xl bg-secondary/10 flex items-center justify-center">
                                        <Users className="size-5 text-secondary" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">Collaboration request</p>
                                        <p className="text-xs text-slate-400 mt-0.5 max-w-lg truncate">
                                            {collab.message || 'Wants to collaborate with you.'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRespond(collab.id)}
                                    disabled={respondingId === collab.id}
                                    className="px-5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                                >
                                    {respondingId === collab.id ? 'Accepting...' : 'Accept'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* My collaborations */}
            {mine.length > 0 && (
                <motion.div variants={item} className="space-y-4">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <Users className="size-5 text-primary" />
                        Your Collaborations
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {mine.map((collab) => (
                            <div key={collab.id} className="card-premium p-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                                        {collab.status === 'completed'
                                            ? <CheckCircle2 className="size-4 text-sky-400" />
                                            : collab.status === 'accepted'
                                            ? <Handshake className="size-4 text-emerald-400" />
                                            : <Clock className="size-4 text-amber-400" />}
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium truncate">
                                        {collab.message || `Collaboration #${collab.id}`}
                                    </p>
                                </div>
                                <span className={cn(
                                    'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shrink-0',
                                    COLLAB_STATUS_STYLE[collab.status] || COLLAB_STATUS_STYLE.pending
                                )}>
                                    {collab.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
