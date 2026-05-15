'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    Calendar,
    Sparkles,
    Target,
    Bot,
    ChevronDown,
    Music2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, ReleaseTimingData, ReleaseWindow } from '@/lib/api';

interface ReleaseTimerDialProps {
    className?: string;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBR: Record<string, string> = {
    Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
    Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT', Sunday: 'SUN',
};

export default function ReleaseTimerDial({ className }: ReleaseTimerDialProps) {
    const [data, setData] = useState<ReleaseTimingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await aiApi.getReleaseTiming();
                setData(result);
            } catch {
                // Fallback mock
                setData({
                    golden_window: { day: 'Friday', time_utc: '18:00', time_label: '6:00 PM GMT', score: 96.4 },
                    alternatives: [
                        { day: 'Thursday', time_utc: '22:00', time_label: '10:00 PM GMT', score: 78.2 },
                        { day: 'Wednesday', time_utc: '14:00', time_label: '2:00 PM GMT', score: 65.8 },
                        { day: 'Saturday', time_utc: '10:00', time_label: '10:00 AM GMT', score: 58.3 },
                        { day: 'Monday', time_utc: '08:00', time_label: '8:00 AM GMT', score: 42.1 },
                        { day: 'Tuesday', time_utc: '16:00', time_label: '4:00 PM GMT', score: 39.7 },
                        { day: 'Sunday', time_utc: '20:00', time_label: '8:00 PM GMT', score: 35.4 },
                    ],
                    justification: 'Recommended for maximum Algorithmic Spike on New Music Friday. Friday 6 PM GMT aligns with peak editorial playlist refresh windows.',
                    playlist_target: 'New Music Friday, Fresh Finds, Release Radar',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Build a map day -> score for the calendar view
    const scoreMap: Record<string, { score: number; time: string }> = {};
    if (data) {
        scoreMap[data.golden_window.day] = { score: data.golden_window.score, time: data.golden_window.time_label };
        data.alternatives.forEach(alt => {
            scoreMap[alt.day] = { score: alt.score, time: alt.time_label };
        });
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'from-emerald-500 to-emerald-400';
        if (score >= 70) return 'from-primary to-indigo-400';
        if (score >= 50) return 'from-amber-500 to-yellow-400';
        return 'from-slate-600 to-slate-500';
    };

    const getScoreBorder = (score: number) => {
        if (score >= 90) return 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]';
        if (score >= 70) return 'border-primary/30';
        if (score >= 50) return 'border-amber-500/20';
        return 'border-white/[0.04]';
    };

    const getScoreText = (score: number) => {
        if (score >= 90) return 'text-emerald-400';
        if (score >= 70) return 'text-primary';
        if (score >= 50) return 'text-amber-400';
        return 'text-slate-500';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
                'relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-2xl',
                'shadow-[0_0_40px_rgba(16,185,129,0.03)]',
                className
            )}
        >
            {/* Header */}
            <div className="p-5 pb-3 flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Clock className="size-4 text-emerald-400" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981,0_0_16px_#10b981] animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-400">Release Timer</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Optimal Window</p>
                    </div>
                </div>
                <Calendar className="size-4 text-slate-600" />
            </div>

            {loading ? (
                <div className="p-5 space-y-3 animate-pulse">
                    <div className="h-24 bg-white/[0.02] rounded-xl" />
                    <div className="h-16 bg-white/[0.02] rounded-xl" />
                </div>
            ) : data && (
                <div className="p-5 space-y-5">
                    {/* Golden Window Hero */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="relative p-5 rounded-2xl bg-[#050505] border border-emerald-500/20 overflow-hidden group/golden"
                    >
                        {/* Animated glow background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-emerald-500/[0.03] opacity-60 group-hover/golden:opacity-100 transition-opacity duration-700" />
                        <motion.div
                            className="absolute -top-20 -right-20 size-40 bg-emerald-500/10 rounded-full blur-[60px]"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        />

                        <div className="relative z-10 flex items-center gap-5">
                            {/* Time Ring */}
                            <div className="relative size-20 shrink-0">
                                <svg className="size-full -rotate-90" viewBox="0 0 80 80">
                                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                                    <motion.circle
                                        cx="40" cy="40" r="34" fill="none"
                                        stroke="#10b981"
                                        strokeWidth="6"
                                        strokeLinecap="round"
                                        strokeDasharray={`${2 * Math.PI * 34}`}
                                        initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                                        animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - data.golden_window.score / 100) }}
                                        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
                                        style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))' }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-lg font-black text-white">{data.golden_window.score.toFixed(0)}</span>
                                    <span className="text-[7px] font-black uppercase tracking-widest text-emerald-400">Score</span>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/70 mb-1">Golden Window</p>
                                <h4 className="text-xl font-black text-white tracking-tight">
                                    {data.golden_window.day}
                                </h4>
                                <p className="text-sm font-bold text-emerald-400 mt-0.5">
                                    {data.golden_window.time_label}
                                </p>
                            </div>

                            <div className="shrink-0">
                                <Target className="size-5 text-emerald-400/40" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Weekly Calendar Strip */}
                    <div className="grid grid-cols-7 gap-1.5">
                        {DAYS_ORDER.map((day, i) => {
                            const info = scoreMap[day];
                            const isGolden = day === data.golden_window.day;
                            const score = info?.score || 0;

                            return (
                                <motion.div
                                    key={day}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + i * 0.05 }}
                                    className={cn(
                                        'relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all',
                                        isGolden
                                            ? 'bg-emerald-500/10 border-emerald-500/30'
                                            : 'bg-[#050505] border-white/[0.04] hover:border-white/10'
                                    )}
                                >
                                    <span className={cn(
                                        'text-[8px] font-black uppercase tracking-widest',
                                        isGolden ? 'text-emerald-400' : 'text-slate-600'
                                    )}>
                                        {DAY_ABBR[day]}
                                    </span>

                                    {/* Score bar */}
                                    <div className="w-full h-8 bg-white/[0.02] rounded-md overflow-hidden relative">
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${score}%` }}
                                            transition={{ duration: 0.8, delay: 0.6 + i * 0.05, ease: 'easeOut' }}
                                            className={cn(
                                                'absolute bottom-0 left-0 right-0 rounded-md bg-gradient-to-t',
                                                getScoreColor(score)
                                            )}
                                            style={isGolden ? { boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)' } : {}}
                                        />
                                    </div>

                                    <span className={cn(
                                        'text-[9px] font-black',
                                        getScoreText(score)
                                    )}>
                                        {score > 0 ? `${score.toFixed(0)}` : '—'}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Justification */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-white/[0.04] hover:border-emerald-500/15 transition-all cursor-pointer group/just"
                    >
                        <div className="flex items-center gap-2">
                            <Bot className="size-3.5 text-emerald-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/just:text-emerald-400 transition-colors">
                                AI Justification
                            </span>
                        </div>
                        <ChevronDown className={cn(
                            'size-3.5 text-slate-600 transition-transform',
                            showDetails && 'rotate-180'
                        )} />
                    </button>

                    <AnimatePresence>
                        {showDetails && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-3">
                                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                        {data.justification}
                                    </p>
                                    <div className="flex items-center gap-2 pt-1">
                                        <Music2 className="size-3 text-emerald-400" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">
                                            Target: {data.playlist_target}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}
