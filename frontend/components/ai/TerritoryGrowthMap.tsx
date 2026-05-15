'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe2,
    Info,
    X,
    TrendingUp,
    Sparkles,
    Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, TerritoryGrowthItem, TerritoryGrowthData } from '@/lib/api';

interface TerritoryGrowthMapProps {
    className?: string;
}

export default function TerritoryGrowthMap({ className }: TerritoryGrowthMapProps) {
    const [data, setData] = useState<TerritoryGrowthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeReason, setActiveReason] = useState<string | null>(null);
    const [activeCountry, setActiveCountry] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await aiApi.getTerritoryGrowth();
                setData(result);
            } catch {
                // Fallback mock
                setData({
                    territories: [
                        { country: 'Brazil', country_code: 'BR', growth_percentage: 45.2, streams: 128400, reason: 'Rhythmic match with local Funk Carioca trends.', flag_emoji: '🇧🇷' },
                        { country: 'India', country_code: 'IN', growth_percentage: 38.7, streams: 95200, reason: 'Fusion of electronic and classical elements resonates with the indie scene.', flag_emoji: '🇮🇳' },
                        { country: 'Nigeria', country_code: 'NG', growth_percentage: 31.5, streams: 72100, reason: 'Afrobeats rhythmic DNA match with Amapiano-influenced playlists.', flag_emoji: '🇳🇬' },
                        { country: 'Germany', country_code: 'DE', growth_percentage: 27.3, streams: 67800, reason: 'Strong techno/electronic listener base. 3 editorial playlists.', flag_emoji: '🇩🇪' },
                        { country: 'Mexico', country_code: 'MX', growth_percentage: 22.1, streams: 54300, reason: 'Latin crossover appeal detected.', flag_emoji: '🇲🇽' },
                        { country: 'Japan', country_code: 'JP', growth_percentage: 18.4, streams: 41200, reason: 'Lo-fi and synthwave trending. City-pop revival audience overlap.', flag_emoji: '🇯🇵' },
                        { country: 'United Kingdom', country_code: 'GB', growth_percentage: 15.6, streams: 38900, reason: 'Drill and bass music communities sharing your track.', flag_emoji: '🇬🇧' },
                        { country: 'South Korea', country_code: 'KR', growth_percentage: 12.8, streams: 29400, reason: 'K-Pop adjacent production style detected.', flag_emoji: '🇰🇷' },
                    ],
                    summary: 'Your music is resonating strongest in emerging markets.',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatStreams = (n: number) => {
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toString();
    };

    const getBarWidth = (pct: number, max: number) => `${(pct / max) * 100}%`;

    const maxGrowth = data ? Math.max(...data.territories.map(t => t.growth_percentage)) : 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
                'relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-2xl',
                'shadow-[0_0_40px_rgba(0,242,254,0.03)]',
                className
            )}
        >
            {/* Header */}
            <div className="p-5 pb-3 flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Globe2 className="size-4 text-emerald-400" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981,0_0_16px_#10b981] animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-400">Territory Growth</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">AI-Powered Analysis</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
                    <Sparkles className="size-3 text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live</span>
                </div>
            </div>

            {/* Territory List */}
            <div className="p-5 space-y-2.5 max-h-[420px] overflow-y-auto custom-scrollbar">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-14 bg-white/[0.02] rounded-xl animate-pulse" />
                    ))
                ) : (
                    data?.territories.map((territory, i) => (
                        <motion.div
                            key={territory.country_code}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="relative group/item"
                        >
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#050505] border border-white/[0.04] hover:border-emerald-500/20 transition-all cursor-default">
                                {/* Flag + Country */}
                                <span className="text-lg w-7 text-center shrink-0">{territory.flag_emoji}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-sm font-bold text-white truncate">{territory.country}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                {formatStreams(territory.streams)}
                                            </span>
                                            <span className="text-sm font-black text-emerald-400">
                                                ↑ {territory.growth_percentage}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Growth Bar */}
                                    <div className="h-1.5 w-full bg-white/[0.03] rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: getBarWidth(territory.growth_percentage, maxGrowth) }}
                                            transition={{ duration: 1, delay: 0.3 + i * 0.06, ease: 'easeOut' }}
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                                            style={{
                                                boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Why Button */}
                                <button
                                    onClick={() => {
                                        if (activeCountry === territory.country_code) {
                                            setActiveReason(null);
                                            setActiveCountry(null);
                                        } else {
                                            setActiveReason(territory.reason);
                                            setActiveCountry(territory.country_code);
                                        }
                                    }}
                                    className={cn(
                                        'shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer',
                                        activeCountry === territory.country_code
                                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                            : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-emerald-400 hover:border-emerald-500/20'
                                    )}
                                >
                                    Why?
                                </button>
                            </div>

                            {/* Reasoning Popup */}
                            <AnimatePresence>
                                {activeCountry === territory.country_code && activeReason && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                        animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-2.5">
                                            <Bot className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">AI Reasoning</p>
                                                <p className="text-xs text-slate-300 leading-relaxed font-medium">{activeReason}</p>
                                            </div>
                                            <button
                                                onClick={() => { setActiveReason(null); setActiveCountry(null); }}
                                                className="shrink-0 text-slate-600 hover:text-white transition-colors cursor-pointer"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Summary Footer */}
            {data?.summary && (
                <div className="px-5 pb-4 pt-1">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                            <Sparkles className="size-3 text-emerald-400 inline mr-1.5 align-middle" />
                            {data.summary}
                        </p>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
