'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe2,
    X,
    Bot,
    MapPin,
    ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, TerritoryGrowthData } from '@/lib/api';

interface TerritoryGrowthMapProps {
    trackId?: string;
    className?: string;
}

interface RegionalFocusArea {
    rank: number;
    region: string;
    platform: string;
    score: number;
    growthPct: number;
    actionBadge: string;
    reason: string;
    flagEmoji: string;
}

const INDIA_FOCUS_AREAS: RegionalFocusArea[] = [
    {
        rank: 1,
        region: 'Punjab & North India',
        platform: 'Instagram Reels',
        score: 91.5,
        growthPct: 85.4,
        actionBadge: 'Collaborate with regional Punjabi Reels creators',
        reason: 'Rhythmic basslines and melodic hooks matches trending short-form audio trends across Chandigarh, Delhi & Punjab.',
        flagEmoji: '🇮🇳',
    },
    {
        rank: 2,
        region: 'Maharashtra / Mumbai',
        platform: 'Spotify India',
        score: 44.0,
        growthPct: 38.2,
        actionBadge: 'Pitch Spotify India Editorial & Local Live Venues',
        reason: 'Strong Spotify India organic save rates detected. High engagement in Mumbai urban indie playlists.',
        flagEmoji: '🇮🇳',
    },
    {
        rank: 3,
        region: 'Gujarat',
        platform: 'JioSaavn',
        score: 38.3,
        growthPct: 29.7,
        actionBadge: 'Target JioSaavn Gujarati Indie Playlists',
        reason: 'Growing streaming velocity on JioSaavn driven by regional pop and folk fusion listeners.',
        flagEmoji: '🇮🇳',
    },
];

export default function TerritoryGrowthMap({ trackId, className }: TerritoryGrowthMapProps) {
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
                setData({
                    territories: [
                        { country: 'India', country_code: 'IN', growth_percentage: 85.4, streams: 195200, reason: 'Punjab & North India Reels viral explosion.', flag_emoji: '🇮🇳' },
                        { country: 'United States', country_code: 'US', growth_percentage: 42.1, streams: 84300, reason: 'NRI Diaspora listener concentration in Bay Area & NYC.', flag_emoji: '🇺🇸' },
                        { country: 'United Kingdom', country_code: 'GB', growth_percentage: 28.6, streams: 42100, reason: 'BBC Asian Network airplay crossover.', flag_emoji: '🇬🇧' },
                        { country: 'Canada', country_code: 'CA', growth_percentage: 24.3, streams: 38900, reason: 'Brampton & Toronto South Asian streaming surge.', flag_emoji: '🇨🇦' },
                    ],
                    summary: 'India is your primary growth engine (85.4% 30-day velocity).',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [trackId]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={cn('card-premium p-6', className)}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="size-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Globe2 className="size-4 text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Territory &amp; Platform Focus</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Regional AI Acceleration</p>
                </div>
            </div>

            {/* India Territory Focus Areas */}
            <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <MapPin className="size-3.5 text-emerald-400" />
                    Ranked Indian Territory Focus Areas
                </h4>

                <div className="space-y-3">
                    {INDIA_FOCUS_AREAS.map((area) => (
                        <div
                            key={area.rank}
                            className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors space-y-3"
                        >
                            {/* Top Title & Score */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 size-6 rounded-lg flex items-center justify-center border border-emerald-500/20 shrink-0">
                                        #{area.rank}
                                    </span>
                                    <span className="text-sm font-bold text-white truncate">
                                        {area.region} <span className="text-xs text-slate-500 font-normal">({area.platform})</span>
                                    </span>
                                </div>
                                <span className="text-xs font-black text-emerald-400 shrink-0">
                                    Score: {area.score} / 100
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${area.score}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                    className="h-full rounded-full bg-emerald-400"
                                />
                            </div>

                            {/* Action Badge */}
                            <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg flex items-center gap-1">
                                    <ArrowUpRight className="size-3" />
                                    {area.actionBadge}
                                </span>
                                <button
                                    onClick={() => {
                                        if (activeCountry === String(area.rank)) {
                                            setActiveReason(null);
                                            setActiveCountry(null);
                                        } else {
                                            setActiveReason(area.reason);
                                            setActiveCountry(String(area.rank));
                                        }
                                    }}
                                    className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors"
                                >
                                    {activeCountry === String(area.rank) ? 'Hide' : 'Why?'}
                                </button>
                            </div>

                            {/* Reasoning */}
                            <AnimatePresence>
                                {activeCountry === String(area.rank) && activeReason && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5 flex items-start gap-2.5">
                                            <Bot className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">AI Regional Strategy</p>
                                                <p className="text-xs text-slate-300 font-medium leading-relaxed">{activeReason}</p>
                                            </div>
                                            <button
                                                onClick={() => { setActiveReason(null); setActiveCountry(null); }}
                                                className="text-slate-600 hover:text-white transition-colors"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>

                {/* Footer summary */}
                {data?.summary && (
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-slate-400 font-medium">
                        {data.summary}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
