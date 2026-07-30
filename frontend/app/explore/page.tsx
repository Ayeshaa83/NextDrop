'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Compass, Crown, Music2, BadgeCheck, Search, X } from 'lucide-react';
import { useRequireAuth } from '@/lib/auth';
import { useAllArtists, formatNumber } from '@/lib/hooks';

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop';

const RANK_STYLES: Record<number, string> = {
    1: 'bg-amber-400 text-black',
    2: 'bg-slate-300 text-black',
    3: 'bg-amber-700 text-white',
};

function ExplorePageContent() {
    const { isLoading: authLoading } = useRequireAuth();
    const { data: artistsPage, loading: artistsLoading } = useAllArtists();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState(searchParams.get('q') || '');

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.06 } },
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    };

    const loading = authLoading || artistsLoading;
    const allArtists = artistsPage?.items || [];

    const searchQuery = search.trim().toLowerCase();
    const artists = searchQuery
        ? allArtists.filter((artist) => artist.stage_name.toLowerCase().includes(searchQuery))
        : allArtists;

    if (authLoading) return null;

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-[1600px] mx-auto space-y-10"
        >
            <motion.header variants={item} className="space-y-4">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase flex items-center gap-2">
                        <Compass className="size-3" />
                        Discovery Hub
                    </p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Explore Artists</h1>
                    <p className="text-slate-500 font-medium">
                        Every approved artist on NextDrop, ranked by total real streams across their released tracks.
                    </p>
                </div>

                <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search artists by name..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>
            </motion.header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="size-10 border-2 border-primary border-t-transparent rounded-full"
                    />
                </div>
            ) : artists.length === 0 ? (
                <motion.div
                    variants={item}
                    className="card-premium p-16 flex flex-col items-center gap-4 text-center border-dashed border-2 border-white/5"
                >
                    <Music2 className="size-10 text-slate-600" />
                    <p className="text-slate-400 font-medium">
                        {search
                            ? `No artists match "${search}".`
                            : "No approved artists yet. Once artists are onboarded and their tracks approved, they'll show up here."}
                    </p>
                </motion.div>
            ) : (
                <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {artists.map((artist) => (
                        <Link key={artist.id} href={`/artists/${artist.id}`} className="group">
                            <div className="card-premium p-6 flex flex-col items-center text-center gap-4 h-full hover:border-primary/40 hover:-translate-y-1 transition-all">
                                <div className="relative">
                                    <div className="size-24 rounded-full overflow-hidden border-2 border-white/5 shadow-xl ring-2 ring-primary/10">
                                        <img
                                            src={artist.profile_picture || FALLBACK_AVATAR}
                                            alt={artist.stage_name}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                        />
                                    </div>
                                    <span
                                        className={`absolute -top-1 -left-1 size-7 rounded-full flex items-center justify-center text-[11px] font-black shadow-lg border-2 border-[#050505] ${
                                            RANK_STYLES[artist.rank] || 'bg-white/10 text-white'
                                        }`}
                                    >
                                        {artist.rank <= 3 ? <Crown className="size-3.5" /> : artist.rank}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <h3 className="text-white font-bold text-base tracking-tight">{artist.stage_name}</h3>
                                        {artist.is_verified && <BadgeCheck className="size-4 text-primary shrink-0" />}
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Rank #{artist.rank}
                                    </p>
                                </div>

                                <div className="flex items-center gap-4 mt-auto pt-2 border-t border-white/5 w-full justify-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <span>{formatNumber(artist.total_streams)} streams</span>
                                    <div className="w-1 h-1 rounded-full bg-white/10" />
                                    <span>{artist.track_count} tracks</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </motion.div>
            )}
        </motion.div>
    );
}

export default function ExplorePage() {
    return (
        <Suspense fallback={null}>
            <ExplorePageContent />
        </Suspense>
    );
}
