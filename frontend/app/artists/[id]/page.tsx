'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Play,
    Pause,
    BadgeCheck,
    Crown,
    Music as MusicIcon,
    AlertCircle,
    Disc3,
    BarChart3,
} from 'lucide-react';

import { useRequireAuth } from '@/lib/auth';
import { useArtist, useArtistTracks, formatNumber, formatDuration } from '@/lib/hooks';
import { usePlayer } from '@/lib/playerStore';
import { DEFAULT_AVATAR } from '@/lib/avatar';

const FALLBACK_AVATAR = DEFAULT_AVATAR;
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=500&auto=format&fit=crop';

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' as const, delay },
});

export default function ArtistProfilePage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const artistId = Number(params.id);

    const { isLoading: authLoading } = useRequireAuth();
    const { data: artist, loading: artistLoading, error: artistError } = useArtist(artistId);
    const { data: tracksPage, loading: tracksLoading } = useArtistTracks(artistId);
    const { playTracks, currentTrack, isPlaying, toggle } = usePlayer();

    const loading = authLoading || artistLoading;

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

    if (artistError || !artist) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] gap-4">
                <AlertCircle className="size-10 text-red-400" />
                <p className="text-slate-400 font-medium">Artist not found.</p>
                <button
                    onClick={() => router.push('/explore')}
                    className="px-6 py-2.5 rounded-xl bg-white/5 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                    Back to Explore
                </button>
            </div>
        );
    }

    const tracks = tracksPage?.items || [];

    const handlePlay = (trackId: number) => {
        if (currentTrack?.id === trackId) {
            toggle();
            return;
        }
        const playerTracks = tracks
            .filter((t) => t.file_url)
            .map((t) => ({
                id: t.id,
                title: t.title,
                artist: artist.stage_name,
                url: t.file_url,
                coverUrl: t.cover_art_url || FALLBACK_COVER,
                duration: t.duration,
            }));
        const startIndex = playerTracks.findIndex((t) => t.id === trackId);
        if (startIndex === -1) return;
        playTracks(playerTracks, startIndex);
    };

    const stats = [
        { label: 'Rank', value: `#${artist.rank}`, icon: Crown },
        { label: 'Total Streams', value: formatNumber(artist.total_streams), icon: BarChart3 },
        { label: 'Tracks', value: artist.track_count.toString(), icon: Disc3 },
    ];

    return (
        <div className="p-8 lg:p-12 max-w-[1200px] mx-auto space-y-10 pb-32">

            {/* Back button */}
            <motion.div {...fadeUp(0)}>
                <button
                    onClick={() => router.push('/explore')}
                    className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                    <ArrowLeft className="size-4" />
                    Back to Explore
                </button>
            </motion.div>

            {/* Hero */}
            <motion.div {...fadeUp(0.07)} className="flex flex-col md:flex-row gap-8 items-start md:items-end">
                <div className="relative size-40 md:size-48 rounded-full overflow-hidden shrink-0 shadow-2xl ring-2 ring-primary/20 border-2 border-white/5">
                    <img src={artist.profile_picture || FALLBACK_AVATAR} className="size-full object-cover" alt={artist.stage_name} />
                </div>
                <div className="space-y-3 flex-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Artist Profile</p>
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{artist.stage_name}</h1>
                        {artist.is_verified && <BadgeCheck className="size-7 text-primary shrink-0" />}
                    </div>
                    {artist.bio && (
                        <p className="text-slate-400 max-w-xl text-sm font-medium leading-relaxed">{artist.bio}</p>
                    )}
                </div>
            </motion.div>

            {/* Stats */}
            <motion.div {...fadeUp(0.14)} className="grid grid-cols-3 gap-4">
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

            {/* Tracks */}
            <motion.div {...fadeUp(0.21)} className="space-y-4">
                <h2 className="text-xl font-black text-white">Released Tracks</h2>

                {tracksLoading ? (
                    <div className="card-premium p-8 flex items-center justify-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="size-6 border-2 border-primary border-t-transparent rounded-full"
                        />
                    </div>
                ) : tracks.length === 0 ? (
                    <div className="card-premium p-8 flex flex-col items-center gap-3 text-center border-dashed border-2 border-white/5">
                        <MusicIcon className="size-8 text-slate-600" />
                        <p className="text-sm text-slate-400 font-medium">No released tracks yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {tracks.map((track, i) => {
                            const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying;
                            return (
                                <motion.div
                                    key={track.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeOut' as const, delay: 0.25 + i * 0.05 }}
                                    className="card-premium p-4 pr-6 flex items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <button
                                            onClick={() => handlePlay(track.id)}
                                            disabled={!track.file_url}
                                            className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 active:scale-95 transition-all shrink-0 disabled:opacity-40"
                                        >
                                            {isCurrentlyPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
                                        </button>
                                        <div className="min-w-0">
                                            <h3 className="text-white font-bold text-sm truncate">{track.title}</h3>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                                                {track.genre || 'Single'} · {formatDuration(track.duration)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                                        {formatNumber(track.stream_count)} streams
                                    </span>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
