'use client';

import { useState } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useLeaderboard, useLeaderboardCategories, useMyLeaderboardPosition, formatNumber } from '@/lib/hooks';
import {
    Trophy,
    Crown,
    Star
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function Leaderboard() {
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const [category, setCategory] = useState<string | undefined>(undefined);
    const { data: leaderboardData, loading: leaderboardLoading } = useLeaderboard(category);
    const { data: categoryData } = useLeaderboardCategories();
    const { data: myPosition } = useMyLeaderboardPosition(category);

    const loading = authLoading || leaderboardLoading;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="size-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-slate-500 font-medium animate-pulse">Calculating global rankings...</p>
                </div>
            </div>
        );
    }

    const items = leaderboardData?.items || [];

    // Default avatars
    const getAvatar = (i: number) => `https://images.unsplash.com/photo-${[
        '1570295999919-56ceb5ecca61',
        '1534528741775-53994a69daeb',
        '1506794778202-cad84cf45f1d',
        '1518020382113-a7e8fc38eac9',
        '1544005313-94ddf0286df2'
    ][i % 5]}?q=80&w=200&auto=format&fit=crop`;

    const winners = items.slice(0, 3).map((entry: any, i: number) => ({
        ...entry,
        avatar: entry.profile_picture || getAvatar(i),
        rank: i + 1
    }));

    // Reorder for podium: 2, 1, 3
    const podiumOrder = winners.length >= 3
        ? [winners[1], winners[0], winners[2]]
        : winners;

    const rankings = items.slice(3).map((entry: any, i: number) => ({
        ...entry,
        avatar: entry.profile_picture || getAvatar(i + 3),
        rank: i + 4
    }));

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
                    <p className="text-secondary font-black tracking-[0.2em] text-[10px] uppercase">Global Network</p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Leaderboard</h1>
                </div>
                <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/5 overflow-x-auto">
                    <button
                        onClick={() => setCategory(undefined)}
                        className={cn(
                            "px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                            !category ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
                        )}
                    >
                        All
                    </button>
                    {(categoryData?.categories || []).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setCategory(tab)}
                            className={cn(
                                "px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                                category === tab ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </motion.header>

            {/* Podium */}
            <div className="flex justify-center items-end gap-6 h-96 relative">
                {podiumOrder.map((winner, idx) => {
                    const isFirst = winner.rank === 1;
                    const isSecond = winner.rank === 2;
                    const isThird = winner.rank === 3;

                    return (
                        <motion.div
                            key={`winner-${winner.rank}`}
                            variants={item}
                            className={cn(
                                "flex flex-col items-center group relative",
                                isFirst ? "w-80 z-20" : "w-64 z-10"
                            )}
                        >
                            {/* Avatar & Crown */}
                            <div className="relative mb-6">
                                <div className={cn(
                                    "rounded-full p-1.5 transition-transform duration-500 group-hover:scale-110 shadow-2xl",
                                    isFirst ? "size-32 bg-gradient-to-b from-yellow-300 to-amber-600 shadow-amber-500/20" :
                                        isSecond ? "size-24 bg-gradient-to-b from-slate-300 to-slate-500 shadow-slate-500/20" :
                                            "size-24 bg-gradient-to-b from-orange-400 to-orange-800 shadow-orange-500/20"
                                )}>
                                    <img src={winner.avatar} className="size-full rounded-full object-cover border-4 border-[#050505]" />
                                </div>
                                {isFirst && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce">
                                        <Crown className="size-8 text-amber-500 fill-amber-500/20" />
                                    </div>
                                )}
                                <div className={cn(
                                    "absolute -bottom-2 left-1/2 -translate-x-1/2 size-8 rounded-full flex items-center justify-center font-black text-xs border-2 border-[#050505]",
                                    isFirst ? "bg-amber-500 text-black" : "bg-white/10 text-white backdrop-blur-xl"
                                )}>
                                    {winner.rank}
                                </div>
                            </div>

                            {/* Podium Base */}
                            <div className={cn(
                                "card-premium w-full flex flex-col items-center p-6 pt-10 relative overflow-hidden transition-all duration-500 group-hover:border-white/20",
                                isFirst ? "h-64" : isSecond ? "h-52" : "h-44"
                            )}>
                                <div className={cn(
                                    "absolute top-0 inset-x-0 h-1",
                                    isFirst ? "bg-amber-500" : isSecond ? "bg-slate-400" : "bg-orange-600"
                                )} />
                                <h3 className="text-lg font-black text-white truncate w-full text-center">{winner.stage_name}</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 mb-6">World Class Artist</p>

                                <div className="mt-auto w-full space-y-2">
                                    <div className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Points</span>
                                        <span className="text-sm font-black text-white">{winner.points.toFixed(0)}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* List Rankings */}
            <motion.div variants={item} className="space-y-4">
                <div className="flex items-center px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 mb-2">
                    <div className="w-16 text-center">Rank</div>
                    <div className="flex-1">Artist</div>
                    <div className="w-32 text-right">Points</div>
                </div>

                {rankings.map((row, idx) => (
                    <div key={row.rank} className="card-premium p-4 flex items-center hover:scale-[1.01] transition-all cursor-pointer group">
                        <div className="w-16 flex justify-center items-center">
                            <span className="text-xl font-black text-slate-800 group-hover:text-primary/40 transition-colors uppercase italic tracking-tighter">
                                {String(row.rank).padStart(2, '0')}
                            </span>
                        </div>

                        <div className="flex-1 flex items-center gap-5">
                            <div className="size-12 rounded-xl overflow-hidden border border-white/5 group-hover:border-primary/50 transition-colors">
                                <img src={row.avatar} className="size-full object-cover" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold group-hover:text-primary transition-colors">{row.stage_name}</h4>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verified Artist</p>
                            </div>
                        </div>

                        <div className="w-32 text-right pr-4">
                            <span className="text-lg font-black text-white tabular-nums">{row.points.toFixed(0)}</span>
                        </div>
                    </div>
                ))}

                <div className="w-full py-5 card-premium border-dashed text-slate-600 text-center text-xs font-black uppercase tracking-[0.3em]">
                    Showing top {items.length} of {formatNumber(leaderboardData?.total || items.length)} ranked artists
                </div>
            </motion.div>

            {/* Sticky Footer for User Rank */}
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring", damping: 20 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-2xl border-t border-white/10 p-4 lg:p-6 lg:ml-[240px]"
            >
                <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-full overflow-hidden border-2 border-primary/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                            <img src={artist?.profile_picture || "https://i.pravatar.cc/150"} alt="User" className="size-full object-cover" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Your Current Rank</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                {myPosition?.ranked ? (
                                    <>#{myPosition.rank}
                                        <span className="text-slate-500 text-sm ml-2 font-bold">
                                            of {myPosition.total_artists} ranked artists
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-slate-400 text-lg">Unranked — release music to enter the rankings</span>
                                )}
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Points</p>
                            <p className="text-lg font-bold text-white tabular-nums">
                                {myPosition?.ranked ? formatNumber(myPosition.points || 0) : '—'}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

        </motion.div>
    );
}
