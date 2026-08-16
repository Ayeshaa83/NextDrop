'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePlayerStore } from '@/lib/playerStore';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Shuffle,
    Repeat,
    Repeat1,
    Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function GlobalPlayer() {
    const pathname = usePathname();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    const {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffled,
        repeatMode,
        setAudioRef,
        toggle,
        next,
        previous,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeat,
        setCurrentTime,
        setDuration,
        setIsPlaying,
    } = usePlayerStore();

    // Register audio ref with store
    useEffect(() => {
        setAudioRef(audioRef.current);
        return () => setAudioRef(null);
    }, [setAudioRef]);

    // Audio event handlers
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onDurationChange = () => setDuration(audio.duration);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => {
            if (repeatMode === 'one') {
                audio.currentTime = 0;
                audio.play();
            } else {
                next();
            }
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);

        audio.volume = volume;

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
        };
    }, [setCurrentTime, setDuration, setIsPlaying, next, repeatMode, volume]);

    // Progress percentage
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Hide the player pill on Auth pages or if no track — but the <audio> element
    // itself must ALWAYS render (see below). If it only mounted once a track
    // existed, audioRef.current would still be null the very first time play()
    // runs (the ref attaches on the render AFTER state updates), and the effect
    // that pushes the ref into the store only runs once on mount — so it would
    // permanently store null and every future play() call would silently no-op.
    const hidePlayerUI = pathname === '/login' || pathname === '/signup' || !currentTrack;

    return (
        <>
            <audio ref={audioRef} preload="metadata" />

            {!hidePlayerUI && (
            <motion.div
                layout
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                className={cn(
                    "fixed bottom-8 left-1/2 -translate-x-1/2 z-50",
                    "glass-pill rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden",
                    "flex items-center px-4 py-3 gap-6 select-none"
                )}
                transition={{ duration: 0.25, ease: "easeOut" }}
            >
                {/* Track Info */}
                <div className="flex items-center gap-3 min-w-0">
                    <motion.div
                        layout
                        className="size-10 rounded-lg overflow-hidden flex-shrink-0 shadow-lg"
                    >
                        <img
                            src={currentTrack.coverUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop"}
                            alt={currentTrack.title}
                            className="w-full h-full object-cover"
                        />
                    </motion.div>
                    <div className="flex flex-col min-w-0 pr-2">
                        <h4 className="text-white font-bold text-xs truncate max-w-[120px]">
                            {currentTrack.title}
                        </h4>
                        <p className="text-slate-400 text-[10px] font-medium truncate max-w-[100px]">
                            {currentTrack.artist}
                        </p>
                    </div>
                </div>

                {/* Main Controls */}
                <div className="flex items-center gap-4">
                    <button onClick={previous} className="text-slate-400 hover:text-white active:scale-95 transition-all">
                        <SkipBack className="size-4 fill-current" />
                    </button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggle}
                        className="size-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg"
                    >
                        {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current translate-x-0.5" />}
                    </motion.button>
                    <button onClick={next} className="text-slate-400 hover:text-white active:scale-95 transition-all">
                        <SkipForward className="size-4 fill-current" />
                    </button>
                </div>

                {/* Right Side Info & Expansion */}
                <div className="flex items-center gap-4">
                    {/* Time & Visualizer */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>

                        {/* Mini Visualizer */}
                        <div className="flex items-end gap-[2px] h-3 w-4">
                            {[1, 2, 3, 4].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={isPlaying ? { height: ["20%", "100%", "40%", "80%", "20%"] } : { height: "20%" }}
                                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                                    className="w-[2px] bg-primary rounded-full"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Hover Expanded Controls */}
                    <AnimatePresence mode="popLayout">
                        {isHovered && (
                            <motion.div
                                initial={{ opacity: 0, width: 0, scale: 0.9 }}
                                animate={{ opacity: 1, width: "auto", scale: 1 }}
                                exit={{ opacity: 0, width: 0, scale: 0.9 }}
                                transition={{
                                    duration: 0.2,
                                    ease: "easeOut"
                                }}
                                className="flex items-center gap-4 pl-4 border-l border-white/10 overflow-hidden whitespace-nowrap"
                            >
                                <button onClick={toggleShuffle} className={cn("transition-colors", isShuffled ? "text-primary" : "text-slate-500 hover:text-white")}>
                                    <Shuffle className="size-3.5" />
                                </button>
                                <button onClick={cycleRepeat} className={cn("transition-colors", repeatMode !== 'off' ? "text-primary" : "text-slate-500 hover:text-white")}>
                                    {repeatMode === 'one' ? <Repeat1 className="size-3.5" /> : <Repeat className="size-3.5" />}
                                </button>

                                <div className="flex items-center gap-2 group w-20">
                                    <button onClick={toggleMute} className="text-slate-500 hover:text-white">
                                        {isMuted || volume === 0 ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                                    </button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={isMuted ? 0 : volume}
                                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Progress Line (Bottom Edge) */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
                    <motion.div
                        layout
                        className="h-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </motion.div>
            )}
        </>
    );
}
