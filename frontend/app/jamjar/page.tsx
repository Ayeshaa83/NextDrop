'use client';

import { useState } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useFeed, formatNumber, useMyTracks } from '@/lib/hooks';
import { feedApi, storageApi, tracksApi, ApiError, SocialPost, Liker } from '@/lib/api';
import {
    Flame,
    MessageSquare,
    Share2,
    Play,
    Plus,
    Verified,
    MoreHorizontal,
    X,
    Zap,
    Sparkles,
    UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SessionErrorBanner from '@/components/SessionErrorBanner';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePlayer } from '@/lib/playerStore';
import { DEFAULT_AVATAR } from '@/lib/avatar';

// Format relative time
function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// Post Card Component
function PostCard({
    post,
    currentArtistId,
}: {
    post: SocialPost;
    currentArtistId?: number;
}) {
    const [commentText, setCommentText] = useState('');
    const [showComments, setShowComments] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [localPost, setLocalPost] = useState(post);
    const [showLikers, setShowLikers] = useState(false);
    const [likers, setLikers] = useState<Liker[] | null>(null);
    const [likersLoading, setLikersLoading] = useState(false);
    // Seeded from the server so a refresh doesn't forget a request was already sent —
    // 'rejected' (or no prior request) still allows sending a new one.
    const initialCollabStatus = post.my_collab_status === 'pending' ? 'pending'
        : (post.my_collab_status === 'accepted' || post.my_collab_status === 'completed') ? 'accepted'
        : 'idle';
    const [collabStatus, setCollabStatus] = useState<'idle' | 'sending' | 'pending' | 'accepted' | 'error'>(initialCollabStatus);
    const [shareCopied, setShareCopied] = useState(false);
    const { playTracks, currentTrack, isPlaying, toggle } = usePlayer();

    const handlePlaySnippet = () => {
        if (!localPost.track?.file_url) return;
        // Already loaded — toggle pause/resume instead of restarting from 0.
        if (currentTrack?.id === localPost.track.id) {
            toggle();
            return;
        }
        playTracks([{
            id: localPost.track.id,
            title: localPost.track.title,
            artist: localPost.artist.stage_name,
            url: localPost.track.file_url,
            duration: localPost.track.duration,
        }], 0);
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/jamjar?post=${localPost.id}`);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
        } catch {
            // Clipboard unavailable — ignore
        }
    };

    const handleCollabRequest = async () => {
        if (collabStatus === 'sending' || collabStatus === 'pending' || collabStatus === 'accepted') return;
        setCollabStatus('sending');
        try {
            await feedApi.sendCollabRequest(localPost.id, `Hey ${localPost.artist.stage_name}, I'd love to collaborate on this!`);
            setCollabStatus('pending');
        } catch (err) {
            console.error('Failed to send collab request:', err);
            setCollabStatus('error');
            setTimeout(() => setCollabStatus('idle'), 2500);
        }
    };

    const handleLike = async () => {
        if (isLiking) return;
        setIsLiking(true);
        try {
            const result = await feedApi.likePost(post.id);
            setLocalPost(prev => ({
                ...prev,
                is_liked: result.is_liked,
                like_count: result.like_count,
            }));
            setLikers(null); // stale now — refetch next time the list is opened
        } catch (err) {
            console.error('Failed to like post:', err);
        } finally {
            setIsLiking(false);
        }
    };

    const handleToggleLikers = async () => {
        if (localPost.like_count === 0) return;
        const opening = !showLikers;
        setShowLikers(opening);
        if (opening && likers === null) {
            setLikersLoading(true);
            try {
                const result = await feedApi.getPostLikes(localPost.id);
                setLikers(result.items);
            } catch (err) {
                console.error('Failed to load likers:', err);
                setLikers([]);
            } finally {
                setLikersLoading(false);
            }
        }
    };

    const handleComment = async () => {
        if (!commentText.trim()) return;
        try {
            await feedApi.commentOnPost(post.id, commentText);
            setCommentText('');
            setLocalPost(prev => ({
                ...prev,
                comment_count: prev.comment_count + 1,
            }));
        } catch (err) {
            console.error('Failed to comment:', err);
        }
    };

    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
            }}
            className={cn(
                "card-premium p-6 group cursor-default relative overflow-hidden transition-all duration-500",
                localPost.post_type === 'open_verse' && "border-secondary/40 shadow-[0_0_30px_rgba(236,72,153,0.15)] bg-gradient-to-br from-secondary/[0.03] to-transparent"
            )}
        >
            {/* Ambient glow for Remix Mode */}
            {localPost.post_type === 'open_verse' && (
                <div className="absolute -top-20 -right-20 size-40 bg-secondary/20 blur-[60px] rounded-full pointer-events-none" />
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-full overflow-hidden border border-white/10 ring-2 ring-transparent group-hover:ring-primary/40 transition-all">
                        <img
                            src={localPost.artist.profile_picture || DEFAULT_AVATAR}
                            alt={localPost.artist.stage_name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <h3 className="text-white font-bold flex items-center gap-1.5 leading-none">
                            {localPost.artist.stage_name}
                            <Verified className="size-3.5 text-blue-400 fill-blue-400/20" />
                        </h3>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                            {formatTimeAgo(localPost.created_at)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {localPost.post_type === 'open_verse' ? (
                        <div className="relative group/badge">
                            <span className="absolute inset-0 border border-secondary/50 rounded-lg rounded-tl-none animate-pulse" />
                            <span className="relative text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg rounded-tl-none bg-secondary/10 text-secondary flex items-center gap-1.5 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                                <Sparkles className="size-3" /> Remix Mode
                            </span>
                        </div>
                    ) : (
                        <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                            localPost.post_type === 'snippet' ? "bg-primary/10 border-primary/20 text-primary" :
                                "bg-white/5 border-white/10 text-slate-400"
                        )}>
                            {localPost.post_type.replace('_', ' ')}
                        </span>
                    )}
                    <button className="text-slate-500 hover:text-white transition-colors cursor-pointer ml-1">
                        <MoreHorizontal className="size-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <p className="text-slate-300 text-sm leading-relaxed mb-6 font-medium">
                {localPost.content}
            </p>

            {/* Audio Snippet Player */}
            {localPost.track && (
                <div className="bg-[#050505]/60 border border-white/5 rounded-2xl p-4 flex items-center gap-5 group/audio hover:border-white/10 transition-all">
                    <button
                        onClick={handlePlaySnippet}
                        disabled={!localPost.track.file_url}
                        className="size-11 rounded-xl bg-white text-black flex items-center justify-center transition-transform active:scale-95 cursor-pointer disabled:opacity-40"
                    >
                        <Play className={cn(
                            "size-5 fill-current",
                            currentTrack?.id === localPost.track.id && isPlaying && "animate-pulse"
                        )} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-white truncate">{localPost.track.title}</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {Math.floor(localPost.track.duration / 60)}:{String(localPost.track.duration % 60).padStart(2, '0')}
                            </span>
                        </div>
                        <div className="flex gap-[2px] items-end h-4 w-full opacity-60">
                            {Array.from({ length: 40 }).map((_, i) => (
                                <div key={i} className="flex-1 bg-white/20 rounded-full" style={{ height: `${Math.random() * 80 + 20}%` }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/5">
                <div className="flex items-center gap-6">
                    <div className={cn(
                        "flex items-center gap-1.5 text-xs font-bold transition-all",
                        localPost.is_liked ? "text-primary" : "text-slate-500"
                    )}>
                        <button
                            onClick={handleLike}
                            disabled={isLiking}
                            title={localPost.is_liked ? 'Unlike' : 'Like'}
                            className="hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <Flame className={cn("size-4", localPost.is_liked && "fill-current")} />
                        </button>
                        <button
                            onClick={handleToggleLikers}
                            disabled={localPost.like_count === 0}
                            title={localPost.like_count > 0 ? 'See who liked this' : undefined}
                            className="hover:text-white transition-colors cursor-pointer disabled:hover:text-inherit disabled:cursor-default"
                        >
                            {formatNumber(localPost.like_count)}
                        </button>
                    </div>
                    <button
                        onClick={() => setShowComments(!showComments)}
                        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-all cursor-pointer"
                    >
                        <MessageSquare className="size-4" />
                        {formatNumber(localPost.comment_count)}
                    </button>
                </div>
                <div className="flex items-center gap-6">
                    <button
                        onClick={handleShare}
                        title="Copy link"
                        className={cn(
                            "flex items-center gap-1.5 transition-all cursor-pointer text-xs font-bold",
                            shareCopied ? "text-emerald-400" : "text-slate-500 hover:text-white"
                        )}
                    >
                        <Share2 className="size-4" />
                        {shareCopied && 'Copied!'}
                    </button>
                    {/* Only other artists can request a collab — not on your own snippet */}
                    {currentArtistId !== undefined && localPost.artist.id !== currentArtistId && (
                        collabStatus === 'accepted' ? (
                            <Link
                                href="/collabs"
                                className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 shadow-primary/5"
                            >
                                Chat
                            </Link>
                        ) : (
                            <button
                                onClick={handleCollabRequest}
                                disabled={collabStatus === 'sending' || collabStatus === 'pending'}
                                className={cn(
                                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg",
                                    collabStatus === 'pending'
                                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                        : collabStatus === 'error'
                                        ? "bg-red-500/10 border border-red-500/20 text-red-400"
                                        : "bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary hover:text-black shadow-secondary/5"
                                )}
                            >
                                {collabStatus === 'pending' ? 'Request Sent ✓'
                                    : collabStatus === 'sending' ? 'Sending...'
                                    : collabStatus === 'error' ? 'Failed — Retry'
                                    : 'Collab'}
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Liked by */}
            <AnimatePresence>
                {showLikers && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Liked by
                            </p>
                            {likersLoading ? (
                                <p className="text-xs text-slate-500 font-medium">Loading...</p>
                            ) : (
                                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {(likers || []).map((liker) => (
                                        <Link
                                            key={liker.artist.id}
                                            href={`/artists/${liker.artist.id}`}
                                            className="flex items-center gap-3 group/liker"
                                        >
                                            <div className="size-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                                                <img
                                                    src={liker.artist.profile_picture || DEFAULT_AVATAR}
                                                    alt={liker.artist.stage_name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <span className="text-[11px] font-bold text-white group-hover/liker:text-primary transition-colors">
                                                {liker.artist.stage_name}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Comments */}
            <AnimatePresence>
                {showComments && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    placeholder="Add a comment..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                                    className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
                                />
                                <button
                                    onClick={handleComment}
                                    className="px-4 py-2 bg-white text-black rounded-xl text-xs font-black uppercase transition-all active:scale-95 cursor-pointer"
                                >
                                    Post
                                </button>
                            </div>
                            <div className="space-y-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {localPost.comments.map(comment => (
                                    <div key={comment.id} className="flex gap-3">
                                        <div className="size-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                                            <img src={comment.artist.profile_picture || undefined} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-white">{comment.artist.stage_name}</span>
                                                <span className="text-[9px] font-black text-slate-500 uppercase">3h ago</span>
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed">{comment.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Reads audio duration (in whole seconds) from a local file before upload.
function readAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
            const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
            URL.revokeObjectURL(url);
            resolve(duration);
        };
        audio.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(0);
        };
        audio.src = url;
    });
}

// Create Post Modal
function CreatePostModal({
    isOpen,
    onClose,
    onSubmit
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (content: string, trackId?: number) => Promise<void>;
}) {
    const [content, setContent] = useState('');
    const [attachMode, setAttachMode] = useState<'library' | 'upload'>('upload');
    const [selectedTrackId, setSelectedTrackId] = useState<number | undefined>(undefined);
    const [snippetFile, setSnippetFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const { data: tracksData } = useMyTracks();
    const tracks = tracksData?.items || [];

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setSnippetFile(file || null);
        setSubmitError(null);
    };

    const handleSubmit = async () => {
        if (!content.trim() || submitting) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            if (attachMode === 'upload' && snippetFile) {
                const duration = await readAudioDuration(snippetFile);
                const { file_url } = await storageApi.uploadFile(snippetFile, 'tracks');
                const newTrack = await tracksApi.createTrack({
                    title: content.trim().slice(0, 60) || snippetFile.name,
                    duration,
                    file_url,
                    is_public: false,
                });
                await onSubmit(content, newTrack.id);
            } else {
                await onSubmit(content, attachMode === 'library' ? selectedTrackId : undefined);
            }
        } catch (err) {
            console.error('Failed to drop snippet:', err);
            setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong — try again.');
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
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="card-premium p-8 w-full max-w-lg shadow-3xl border-white/10"
            >
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-white tracking-tight">Drop a Snippet</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
                        <X className="size-6" />
                    </button>
                </div>

                <div className="space-y-6">
                    <textarea
                        placeholder="What's cooking in the studio? Ask for collabs or share a vibe..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full h-32 bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 resize-none transition-colors"
                    />

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setAttachMode('upload')}
                                className={cn(
                                    "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border",
                                    attachMode === 'upload'
                                        ? "bg-primary text-white border-transparent"
                                        : "bg-white/5 text-slate-400 border-white/5 hover:text-white"
                                )}
                            >
                                Upload a Snippet
                            </button>
                            <button
                                type="button"
                                onClick={() => setAttachMode('library')}
                                className={cn(
                                    "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border",
                                    attachMode === 'library'
                                        ? "bg-primary text-white border-transparent"
                                        : "bg-white/5 text-slate-400 border-white/5 hover:text-white"
                                )}
                            >
                                Pick from Library
                            </button>
                        </div>

                        {attachMode === 'upload' ? (
                            <label className="flex items-center gap-3 w-full bg-white/5 border border-dashed border-white/10 rounded-xl px-4 py-4 text-xs font-bold text-slate-400 hover:border-primary/40 hover:text-white cursor-pointer transition-colors">
                                <UploadCloud className="size-4 shrink-0" />
                                <span className="truncate">{snippetFile ? snippetFile.name : 'Choose an audio file (mp3, wav, m4a)...'}</span>
                                <input type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
                            </label>
                        ) : (
                            <select
                                value={selectedTrackId || ''}
                                onChange={(e) => setSelectedTrackId(e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-4 text-xs font-bold text-white focus:outline-none focus:border-primary/50 appearance-none transition-colors"
                            >
                                <option value="" className="bg-[#0A0A0B]">No track</option>
                                {tracks.map(track => (
                                    <option key={track.id} value={track.id} className="bg-[#0A0A0B]">
                                        {track.title}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {submitError && (
                        <p className="text-xs text-red-400 font-medium px-1">{submitError}</p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!content.trim() || submitting}
                        className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-all active:scale-98 disabled:opacity-30 disabled:grayscale cursor-pointer shadow-xl shadow-primary/20"
                    >
                        {submitting ? 'Dropping...' : 'Drop Highlight 🔥'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function JamJarFeed() {
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const { data: feedData, loading: feedLoading, error: feedError, isAuthError, refetch } = useFeed();
    const [showCreateModal, setShowCreateModal] = useState(false);

    const loading = authLoading || feedLoading;
    const posts = feedData?.items || [];

    const handleCreatePost = async (content: string, trackId?: number) => {
        await feedApi.createPost({ content, post_type: 'snippet', track_id: trackId });
        setShowCreateModal(false);
        refetch();
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="size-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-slate-500 font-medium animate-pulse">Entering the Jam Jar...</p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-[900px] mx-auto space-y-10 relative"
        >
            <AnimatePresence>
                {showCreateModal && (
                    <CreatePostModal
                        isOpen={showCreateModal}
                        onClose={() => setShowCreateModal(false)}
                        onSubmit={handleCreatePost}
                    />
                )}
            </AnimatePresence>

            <motion.header
                variants={item}
                className="flex justify-between items-end"
            >
                <div className="space-y-1">
                    <p className="text-secondary font-black tracking-[0.2em] text-[10px] uppercase">Artist Network</p>
                    <h1 className="text-4xl font-black tracking-tight text-white">The Jam Jar</h1>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-8 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-all active:scale-95 cursor-pointer shadow-xl shadow-primary/20"
                >
                    <Plus className="size-4" />
                    Drop Snippet
                </button>
            </motion.header>

            {/* Posts Stream */}
            <motion.div
                variants={item}
                className="space-y-6"
            >
                {feedError ? (
                    <SessionErrorBanner isAuthError={isAuthError} onRetry={refetch} />
                ) : posts.length === 0 ? (
                    <div className="card-premium p-20 text-center space-y-4">
                        <div className="size-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mx-auto text-slate-500">
                            <Zap className="size-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white">No vibes detected</h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">Be the first to drop a snippet and start a collaboration cycle.</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <PostCard key={post.id} post={post} currentArtistId={artist?.id} />
                    ))
                )}
            </motion.div>
        </motion.div>
    );
}
