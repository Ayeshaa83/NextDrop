'use client';

import { useState, useRef } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useFeed, formatNumber, useMyTracks } from '@/lib/hooks';
import { feedApi, SocialPost, PostType } from '@/lib/api';
import {
    Flame,
    MessageSquare,
    Share2,
    Play,
    Users,
    Plus,
    Verified,
    Search,
    MoreHorizontal,
    X,
    Zap,
    Music,
    Upload,
    Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePlayer } from '@/lib/playerStore';

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
}: {
    post: SocialPost;
}) {
    const [commentText, setCommentText] = useState('');
    const [showComments, setShowComments] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [localPost, setLocalPost] = useState(post);
    const [collabStatus, setCollabStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [shareCopied, setShareCopied] = useState(false);
    const { playTracks, currentTrack, isPlaying } = usePlayer();

    const handlePlaySnippet = () => {
        if (!localPost.track?.file_url) return;
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
        if (collabStatus === 'sending' || collabStatus === 'sent') return;
        setCollabStatus('sending');
        try {
            await feedApi.sendCollabRequest(localPost.id, `Hey ${localPost.artist.stage_name}, I'd love to collaborate on this!`);
            setCollabStatus('sent');
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
        } catch (err) {
            console.error('Failed to like post:', err);
        } finally {
            setIsLiking(false);
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
                            src={localPost.artist.profile_picture || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=200&auto=format&fit=crop'}
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
                    <button
                        onClick={handleLike}
                        className={cn(
                            "flex items-center gap-2 text-xs font-bold transition-all cursor-pointer",
                            localPost.is_liked ? "text-primary" : "text-slate-500 hover:text-white"
                        )}
                    >
                        <Flame className={cn("size-4", localPost.is_liked && "fill-current")} />
                        {formatNumber(localPost.like_count)}
                    </button>
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
                    <button
                        onClick={handleCollabRequest}
                        disabled={collabStatus === 'sending' || collabStatus === 'sent'}
                        className={cn(
                            "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg",
                            collabStatus === 'sent'
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                : collabStatus === 'error'
                                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                                : "bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary hover:text-black shadow-secondary/5"
                        )}
                    >
                        {collabStatus === 'sent' ? 'Request Sent ✓'
                            : collabStatus === 'sending' ? 'Sending...'
                            : collabStatus === 'error' ? 'Failed — Retry'
                            : 'Collab'}
                    </button>
                </div>
            </div>

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

// Create Post Modal
function CreatePostModal({
    isOpen,
    onClose,
    onSubmit
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (content: string, postType: PostType, trackId?: number) => void;
}) {
    const [content, setContent] = useState('');
    const [postType, setPostType] = useState<PostType>('snippet');
    const [selectedTrackId, setSelectedTrackId] = useState<number | undefined>(undefined);
    const { data: tracksData } = useMyTracks();
    const tracks = tracksData?.items || [];
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    if (!isOpen) return null;

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
                    <div className="flex gap-2">
                        {(['snippet', 'open_verse', 'general'] as PostType[]).map(type => (
                            <button
                                key={type}
                                onClick={() => setPostType(type)}
                                className={cn(
                                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                                    postType === type ? "bg-white text-black shadow-lg" : "bg-white/5 text-slate-500 hover:bg-white/10"
                                )}
                            >
                                {type.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    <textarea
                        placeholder="What's cooking in the studio? Ask for collabs or share a vibe..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full h-32 bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 resize-none transition-colors"
                    />

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="audio/*"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 py-4 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-white/5 transition-all group cursor-pointer"
                            >
                                <Upload className="size-5 text-slate-500 group-hover:text-primary transition-colors" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">
                                    {selectedFile ? selectedFile.name : "Upload Direct Audio"}
                                </span>
                            </button>

                            <div className="flex items-center justify-center text-slate-700 text-[10px] font-black uppercase">OR</div>

                            <select
                                value={selectedTrackId || ''}
                                onChange={(e) => setSelectedTrackId(e.target.value ? Number(e.target.value) : undefined)}
                                className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-4 text-xs font-bold text-white focus:outline-none focus:border-primary/50 appearance-none transition-colors"
                            >
                                <option value="" className="bg-[#0A0A0B]">Pick from Library</option>
                                {tracks.map(track => (
                                    <option key={track.id} value={track.id} className="bg-[#0A0A0B]">
                                        {track.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={() => onSubmit(content, postType, selectedTrackId)}
                        disabled={!content.trim()}
                        className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-all active:scale-98 disabled:opacity-30 disabled:grayscale cursor-pointer shadow-xl shadow-primary/20"
                    >
                        Drop Highlight 🔥
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function JamJarFeed() {
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const [activeFilter, setActiveFilter] = useState<PostType | undefined>(undefined);
    const { data: feedData, loading: feedLoading, refetch } = useFeed(activeFilter);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const loading = authLoading || feedLoading;
    const posts = feedData?.items || [];

    const handleCreatePost = async (content: string, postType: PostType, trackId?: number) => {
        try {
            await feedApi.createPost({ content, post_type: postType, track_id: trackId });
            setShowCreateModal(false);
            refetch();
        } catch (err) {
            console.error('Failed to create post:', err);
        }
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
            className="p-8 lg:p-12 max-w-[1400px] mx-auto grid grid-cols-12 gap-10 relative"
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

            {/* Left Feed */}
            <div className="col-span-12 lg:col-span-8 space-y-10">
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

                {/* Feed Filters */}
                <motion.div variants={item} className="flex items-center gap-8 border-b border-white/5 pb-4">
                    {[
                        { label: 'Discovery', val: undefined, icon: Zap },
                        { label: 'Snippets', val: 'snippet', icon: Music },
                        { label: 'Open Verses', val: 'open_verse', icon: Users },
                    ].map((f) => (
                        <button
                            key={f.label}
                            onClick={() => setActiveFilter(f.val as PostType)}
                            className={cn(
                                "flex items-center gap-2 text-xs font-bold transition-all relative pb-4 cursor-pointer",
                                activeFilter === f.val ? "text-white" : "text-slate-500 hover:text-white"
                            )}
                        >
                            <f.icon className="size-4" />
                            {f.label}
                            {activeFilter === f.val && (
                                <motion.div
                                    layoutId="activeFilter"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                />
                            )}
                        </button>
                    ))}
                </motion.div>

                {/* Posts Stream */}
                <motion.div
                    variants={item}
                    className="space-y-6"
                >
                    {posts.length === 0 ? (
                        <div className="card-premium p-20 text-center space-y-4">
                            <div className="size-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mx-auto text-slate-500">
                                <Zap className="size-8" />
                            </div>
                            <h3 className="text-xl font-bold text-white">No vibes detected</h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">Be the first to drop a snippet and start a collaboration cycle.</p>
                        </div>
                    ) : (
                        posts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))
                    )}
                </motion.div>
            </div>

            {/* Right Sidebar */}
            <div className="hidden lg:flex col-span-4 flex-col gap-8 mt-24">
                <motion.div variants={item} className="card-premium p-6 space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Trending Tags</h3>
                    <div className="flex flex-wrap gap-2">
                        {["#hyperpop", "#future-phonk", "#openverse", "#stems", "#producer-tag"].map(tag => (
                            <span key={tag} className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-black text-slate-300 hover:text-white hover:border-primary/40 transition-all cursor-pointer">
                                {tag}
                            </span>
                        ))}
                    </div>
                </motion.div>

                <motion.div variants={item} className="card-premium p-6 space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Suggested Network</h3>
                    <div className="space-y-5">
                        {[
                            { name: 'Axion', role: 'Vocalist', followers: '12K' },
                            { name: 'NullBase', role: 'Producer', followers: '45K' },
                            { name: 'Ethereal', role: 'Co-Writer', followers: '2K' },
                        ].map(u => (
                            <div key={u.name} className="flex items-center justify-between group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-slate-800 border border-white/5 group-hover:border-primary/50 transition-colors" />
                                    <div>
                                        <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">{u.name}</p>
                                        <p className="text-[10px] font-black text-slate-500 uppercase">{u.role} • {u.followers}</p>
                                    </div>
                                </div>
                                <Plus className="size-4 text-slate-500 group-hover:text-white transition-colors" />
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
