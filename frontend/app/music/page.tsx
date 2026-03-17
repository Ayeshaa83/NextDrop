'use client';

import { useRequireAuth } from '@/lib/auth';
import { useMyTracks, formatNumber, formatDuration } from '@/lib/hooks';
import { usePlayer } from '@/lib/playerStore';
import {
    Plus,
    Play,
    Pause,
    MoreVertical,
    Music as MusicIcon,
    Disc,
    Upload,
    Filter,
    Mic2,
    ListMusic
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function MusicLibrary() {
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const { data: tracks, loading: tracksLoading } = useMyTracks();
    const { playTracks, currentTrack, isPlaying } = usePlayer();

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
                    <button className="px-8 py-3 bg-primary text-white rounded-xl text-sm font-black flex items-center gap-2 hover:scale-105 transition-all active:scale-95 cursor-pointer shadow-xl shadow-primary/20">
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
                    // We mock processing status for visual effect if missing
                    const statusText = isProcessing ? 'AI Analyzing...' : 'Ready to Distribute';
                    const statusStyle = isProcessing 
                        ? 'text-primary bg-primary/10 border-primary/20 animate-pulse' 
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
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                            <Mic2 className="size-3" />
                                            {artist?.stage_name || 'Verified Artist'}
                                        </div>
                                        <div className="w-1 h-1 rounded-full bg-white/10" />
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {track.genre || 'Single'}
                                        </div>
                                    </div>
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

                                <button className="text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 p-1">
                                    <MoreVertical className="size-4" />
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}
