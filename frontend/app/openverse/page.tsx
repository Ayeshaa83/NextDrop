'use client';
import { useState } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useMyCollaborations, formatCurrency } from '@/lib/hooks';
import {
    Zap,
    Crown,
    Users,
    Plus,
    Music,
    Timer,
    Download,
    Flame,
    Play,
    Heart,
    Share2,
    IndianRupee,
    Verified
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function OpenVerse() {
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const { data: collaborations, loading: collabLoading } = useMyCollaborations();
    const [isFeaturedLiked, setIsFeaturedLiked] = useState(false);

    const loading = authLoading || collabLoading;

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

    const featuredVerse = {
        artist: "The Weeknd (Mock)",
        title: "Midnight City (Open Verse)",
        cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop",
        bpm: "118",
        key: "F# Min",
        genre: "Synthwave",
        split: "50% Master",
        deadline: "2 Days Left",
        bounty: "$5,000"
    };

    const openVerses = [
        { artist: "Luna Sol", title: "Neon Rain", cover: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=500&auto=format&fit=crop", bpm: "95", key: "C Min", split: "25% Pub", deadline: "1 Week" },
        { artist: "KAI_X", title: "Tokyo Drift", cover: "https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?q=80&w=500&auto=format&fit=crop", bpm: "140", key: "G Min", split: "30% Master", deadline: "3 Days" },
        { artist: "RESONANCE", title: "Abyss", cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=500&auto=format&fit=crop", bpm: "128", key: "E Maj", split: "50% Split", deadline: "12 Hours" },
        { artist: "Axion", title: "Circuit Breaker", cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=500&auto=format&fit=crop", bpm: "110", key: "A Min", split: "Collab Credit", deadline: "Ongoing" },
        { artist: "Vera Blue", title: "Crystalized", cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=500&auto=format&fit=crop", bpm: "88", key: "D Min", split: "20% Master", deadline: "5 Days" },
        { artist: "Night Drive", title: "Highway 99", cover: "https://images.unsplash.com/photo-1470225620880-dba8ba36b745?q=80&w=500&auto=format&fit=crop", bpm: "105", key: "B Min", split: "35% Pub", deadline: "2 Weeks" }
    ];

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
            className="p-8 lg:p-12 max-w-[1400px] mx-auto space-y-12"
        >
            <motion.header variants={item} className="flex justify-between items-end">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Marketplace</p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Open Verses</h1>
                </div>
                <motion.div variants={item} className="flex gap-4">
                    <button
                        onClick={() => alert("Initializing Collab Host flow...")}
                        className="px-8 py-3 bg-primary text-white rounded-xl text-sm font-black flex items-center gap-2 hover:scale-105 transition-all active:scale-95 cursor-pointer shadow-xl shadow-primary/20"
                    >
                        <Plus className="size-4" />
                        Host Collab
                    </button>
                </motion.div>
            </motion.header>

            {/* Featured Hero */}
            <motion.div variants={item} className="group relative w-full h-[450px] rounded-[40px] overflow-hidden cursor-pointer border border-white/5 hover:border-primary/40 transition-all duration-700 shadow-3xl">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" style={{ backgroundImage: `url(${featuredVerse.cover})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent" />

                <div className="absolute inset-0 p-12 flex flex-col justify-end">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2">
                            <Zap className="size-3 fill-current" />
                            Trending Hot
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Bounty Hit</span>
                    </div>
                    <h2 className="text-6xl font-black text-white tracking-tighter mb-4">{featuredVerse.title}</h2>
                    <div className="flex items-center gap-6 mb-10">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-slate-800 border border-white/20" />
                            <div>
                                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                                    {featuredVerse.artist}
                                    <Verified className="size-3.5 text-secondary fill-secondary/20" />
                                </p>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Featured Partner</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="flex gap-8">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bounty</p>
                                <p className="text-xl font-black text-emerald-400">{formatCurrency(5000)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Split %</p>
                                <p className="text-xl font-black text-primary">{featuredVerse.split.replace(' Split', '')}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => alert("Downloading stems package...")}
                            className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all active:scale-95 shadow-2xl flex items-center gap-3 cursor-pointer">
                            <Download className="size-4" />
                            Download Stems
                        </button>
                        <button
                            onClick={() => setIsFeaturedLiked(!isFeaturedLiked)}
                            className={cn(
                                "size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center transition-all cursor-pointer group/heart",
                                isFeaturedLiked ? "text-rose-500 border-rose-500/50 bg-rose-500/5" : "text-white hover:bg-white/10"
                            )}>
                            <Heart className={cn("size-6 transition-colors", isFeaturedLiked && "fill-rose-500")} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {openVerses.map((v, i) => (
                    <motion.div
                        key={i}
                        variants={item}
                        className="card-premium p-4 flex flex-col group hover:border-primary/40 transition-all duration-500 cursor-pointer"
                    >
                        <div className="relative aspect-square rounded-2xl overflow-hidden mb-5">
                            <img src={v.cover} className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                <button className="size-12 rounded-full bg-white text-black flex items-center justify-center transition-transform hover:scale-110 cursor-pointer">
                                    <Play className="size-6 fill-current" />
                                </button>
                            </div>
                            <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-xl rounded-lg border border-white/10 text-[9px] font-black text-white uppercase tracking-widest">
                                {v.bpm} BPM
                            </div>
                        </div>

                        <div className="px-1 flex-1 flex flex-col">
                            <h3 className="text-white font-bold group-hover:text-primary transition-colors truncate">{v.title}</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">By {v.artist}</p>

                            <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Offering</p>
                                    <p className="text-sm font-black text-secondary">{v.split}</p>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <Timer className="size-3.5" />
                                    {v.deadline}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <motion.div variants={item} className="flex justify-center pt-8">
                <button className="px-12 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white hover:border-white/20 transition-all cursor-pointer">
                    Sync Remaining Opportunities
                </button>
            </motion.div>
        </motion.div>
    );
}
