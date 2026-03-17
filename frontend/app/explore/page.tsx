'use client';
import { motion } from 'framer-motion';
import {
    Flame,
    TrendingUp,
    Sparkles,
    Globe,
    Play,
    Plus,
    Compass
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRequireAuth } from '@/lib/auth';

export default function ExplorePage() {
    const { user, isLoading } = useRequireAuth();

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

    const genres = [
        { name: 'Bollywood Remix', tracks: '2.4K', color: 'from-orange-500/20' },
        { name: 'Punjabi Pop', tracks: '1.8K', color: 'from-primary/20' },
        { name: 'Mumbai Hip-Hop', tracks: '3.1K', color: 'from-rose-500/20' },
        { name: 'Lo-Fi Chill', tracks: '950', color: 'from-secondary/20' },
        { name: 'Classical Fusion', tracks: '600', color: 'from-emerald-500/20' },
        { name: 'EDM Blast', tracks: '1.2K', color: 'from-amber-500/20' },
    ];

    if (isLoading) return null;

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-[1600px] mx-auto space-y-16"
        >
            <motion.header variants={item} className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase flex items-center gap-2">
                        <Compass className="size-3" />
                        Discovery Hub
                    </p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Explore the Galaxy</h1>
                </div>
            </motion.header>

            {/* Featured Section */}
            <motion.section variants={item} className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-8 relative h-[450px] rounded-[40px] overflow-hidden group cursor-pointer border border-white/5">
                    <img
                        src="https://images.unsplash.com/photo-1470225620880-dba8ba36b745?q=80&w=1600&auto=format&fit=crop"
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        alt="Featured Artist"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                    <div className="absolute bottom-10 left-10 space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-white text-black text-[10px] font-black uppercase rounded-lg">Artist Spotlight</span>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1">
                                <span className="size-1.5 bg-rose-500 rounded-full animate-pulse" />
                                Trending in India
                            </span>
                        </div>
                        <h2 className="text-5xl font-black text-white tracking-tighter">The Sound of New Mumbai</h2>
                        <p className="text-slate-300 max-w-lg text-sm font-medium leading-relaxed">
                            Discover how local producers are warping traditional sitar samples into heavy-hitting warehouse techno.
                        </p>
                        <button className="px-8 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg active:scale-95">
                            <Play className="size-4 fill-current" />
                            Listen Now
                        </button>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <Flame className="size-5 text-rose-500 fill-rose-500" />
                        Fresh Drops
                    </h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="card-premium p-4 flex gap-4 group hover:border-primary/40 transition-all cursor-pointer">
                                <div className="size-16 rounded-2xl overflow-hidden bg-slate-800 border border-white/5">
                                    <img src={`https://i.pravatar.cc/100?u=${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h5 className="text-white font-bold text-sm tracking-tight group-hover:translate-x-1 transition-transform">Starlight Synth</h5>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">By Producer_X</p>
                                </div>
                                <button className="ml-auto size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                                    <Plus className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button className="w-full py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all">
                        View More Fresh Content
                    </button>
                </div>
            </motion.section>

            {/* Genre Grid */}
            <motion.section variants={item} className="space-y-8">
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <p className="text-slate-500 font-black tracking-[0.2em] text-[10px] uppercase">Browse by Vibe</p>
                        <h3 className="text-2xl font-black text-white">Genre Universe</h3>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {genres.map((genre) => (
                        <div
                            key={genre.name}
                            className={cn(
                                "h-40 rounded-3xl p-6 border border-white/5 flex flex-col justify-between group cursor-pointer transition-all hover:scale-105 hover:border-white/20 relative overflow-hidden bg-gradient-to-br",
                                genre.color,
                                "to-transparent"
                            )}
                        >
                            <div className="size-10 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                                <Sparkles className="size-5 text-white/40 group-hover:text-white transition-colors" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm leading-tight">{genre.name}</h4>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{genre.tracks} Tracks</p>
                            </div>
                            <div className="absolute -right-4 -bottom-4 size-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
                        </div>
                    ))}
                </div>
            </motion.section>

            {/* Global Feed Preview */}
            <motion.section variants={item} className="card-premium p-10 bg-gradient-to-r from-primary/10 via-transparent to-rose-500/10 flex flex-col items-center text-center space-y-6">
                <div className="size-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                    <Globe className="size-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-3xl font-black text-white">Join the Global Wave</h3>
                <p className="text-slate-400 max-w-xl font-medium leading-relaxed">
                    Collaborate with artists from Tokyo to New York. The Open Verse marketplace is expanding with over 500+ new opportunities daily.
                </p>
                <button className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-110 hover:shadow-2xl hover:shadow-primary/20 transition-all active:scale-95 shadow-xl">
                    Open Marketplace
                </button>
            </motion.section>
        </motion.div>
    );
}
