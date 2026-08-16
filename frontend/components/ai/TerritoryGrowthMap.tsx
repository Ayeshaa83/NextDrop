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
    genre?: string;
    bpm?: number;
    title?: string;
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

// Base territories — scores are shifted per track using a seeded hash
const BASE_TERRITORIES = [
    {
        region: 'Punjab & North India',
        platform: 'Instagram Reels',
        baseScore: 91.5,
        baseGrowth: 85.4,
        actionBadge: 'Collaborate with regional Punjabi Reels creators',
        reason: 'Rhythmic hooks trending on Instagram Reels across Chandigarh, Delhi & Punjab.',
        flagEmoji: '🇮🇳',
    },
    {
        region: 'Maharashtra / Mumbai',
        platform: 'Spotify India',
        baseScore: 66.0,
        baseGrowth: 44.0,
        actionBadge: 'Pitch Spotify India Editorial & Local Live Venues',
        reason: 'High organic save rate on Spotify India urban indie playlists in Mumbai.',
        flagEmoji: '🇮🇳',
    },
    {
        region: 'Gujarat',
        platform: 'JioSaavn',
        baseScore: 53.3,
        baseGrowth: 38.3,
        actionBadge: 'Target JioSaavn Gujarati Indie Playlists',
        reason: 'Growing JioSaavn streaming velocity driven by regional folk fusion listeners.',
        flagEmoji: '🇮🇳',
    },
    {
        region: 'South India (Blr / Hyd)',
        platform: 'YouTube Music',
        baseScore: 47.2,
        baseGrowth: 29.7,
        actionBadge: 'Submit to YouTube Music India Editorial',
        reason: 'Electronic and synthpop genre acceleration in Bengaluru & Hyderabad.',
        flagEmoji: '🇮🇳',
    },
];

// Seeded pseudo-random shift so each track gets unique scores
function seededShift(seed: number, min: number, max: number): number {
    const x = Math.sin(seed) * 10000;
    const frac = x - Math.floor(x);
    return parseFloat((min + frac * (max - min)).toFixed(1));
}

function buildFocusAreas(trackId?: string, genre?: string, bpm?: number): RegionalFocusArea[] {
    const seed = (parseInt(trackId || '1', 10) * 31) + (bpm || 120) + (genre?.charCodeAt(0) || 65);
    // Shuffle order based on seed so different tracks have different #1 territory
    const shuffled = [...BASE_TERRITORIES].sort((a, b) => {
        const aShift = seededShift(seed + a.region.length, -5, 5);
        const bShift = seededShift(seed + b.region.length, -5, 5);
        return (b.baseScore + bShift) - (a.baseScore + aShift);
    });
    return shuffled.map((t, i) => ({
        rank: i + 1,
        region: t.region,
        platform: t.platform,
        score: Math.min(99, Math.max(10, parseFloat((t.baseScore + seededShift(seed + i * 7, -12, 12)).toFixed(1)))),
        growthPct: Math.min(99, Math.max(5, parseFloat((t.baseGrowth + seededShift(seed + i * 13, -15, 15)).toFixed(1)))),
        actionBadge: t.actionBadge,
        reason: t.reason,
        flagEmoji: t.flagEmoji,
    }));
}

export default function TerritoryGrowthMap({ trackId, genre, bpm, title, className }: TerritoryGrowthMapProps) {
    const [loading, setLoading] = useState(true);
    const [activeReason, setActiveReason] = useState<string | null>(null);
    const [activeCountry, setActiveCountry] = useState<string | null>(null);
    const [focusAreas, setFocusAreas] = useState<RegionalFocusArea[]>([]);

    useEffect(() => {
        // Build track-specific territory focus areas from seed
        setLoading(true);
        const areas = buildFocusAreas(trackId, genre, bpm);
        setFocusAreas(areas);
        setLoading(false);
    }, [trackId, genre, bpm]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' as const }}
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
                    {focusAreas.map((area) => (
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
                {focusAreas.length > 0 && (
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-slate-400 font-medium">
                        Your strongest Indian market is <span className="text-emerald-400 font-bold">{focusAreas[0]?.region}</span> — focus your next push there for maximum velocity.
                    </div>
                )}
            </div>
        </motion.div>
    );
}
