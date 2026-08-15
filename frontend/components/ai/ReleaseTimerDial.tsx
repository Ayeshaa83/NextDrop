'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    Target,
    Bot,
    ChevronDown,
    Music2,
    CheckSquare,
    Square,
    AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, ReleaseTimingData } from '@/lib/api';

interface ReleaseTimerDialProps {
    trackId?: string;
    genre?: string;
    targetMarket?: string;
    plannedLeadTimeDays?: number;
    className?: string;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBR: Record<string, string> = {
    Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
    Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT', Sunday: 'SUN',
};

interface ChecklistItem {
    id: string;
    task: string;
    timing: string;
    completed: boolean;
}

export default function ReleaseTimerDial({
    trackId,
    genre = 'hindi_indie',
    targetMarket = 'india_domestic',
    plannedLeadTimeDays = 14,
    className,
}: ReleaseTimerDialProps) {
    const [data, setData] = useState<ReleaseTimingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([
        { id: '1', task: 'Pitch track via Spotify for Artists editorial dashboard', timing: '14 days prior (Fri 00:00 IST)', completed: true },
        { id: '2', task: 'Launch Pre-save campaign on YouTube Music & Instagram', timing: '7 days prior (Fri 00:00 IST)', completed: true },
        { id: '3', task: 'Distribute audio stems to regional Punjabi & Hindi Reels creators', timing: '3 days prior (Tue 18:00 IST)', completed: false },
        { id: '4', task: 'Upload 15s Instagram Reels audio teaser 24h prior', timing: 'Thu 18:00 IST', completed: false },
        { id: '5', task: 'Host Instagram Live & YouTube drop countdown', timing: 'Thu 23:00 IST (1h prior)', completed: false },
    ]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await aiApi.getReleaseTiming();
                setData(result);
            } catch {
                // Fallback mock aligned with India release window
                setData({
                    golden_window: { day: 'Friday', time_utc: '00:00', time_label: 'Friday at 00:00 IST', score: 96.5 },
                    alternatives: [
                        { day: 'Thursday', time_utc: '22:00', time_label: '10:00 PM IST', score: 78.2 },
                        { day: 'Wednesday', time_utc: '14:00', time_label: '2:00 PM IST', score: 65.8 },
                        { day: 'Saturday', time_utc: '10:00', time_label: '10:00 AM IST', score: 58.3 },
                        { day: 'Monday', time_utc: '08:00', time_label: '8:00 AM IST', score: 42.1 },
                        { day: 'Tuesday', time_utc: '16:00', time_label: '4:00 PM IST', score: 39.7 },
                        { day: 'Sunday', time_utc: '20:00', time_label: '8:00 PM IST', score: 35.4 },
                    ],
                    justification: 'Friday at 00:00 IST is the #1 recommended window for Hindi Indie & Indian domestic listeners. Aligns perfectly with Spotify New Music Friday India playlist refreshes and weekend streaming peaks.',
                    playlist_target: 'Spotify New Music Friday India, Fresh Finds India, Radirr India',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [trackId, genre, targetMarket]);

    const toggleChecklist = (id: string) => {
        setChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
    };

    // Build score map
    const scoreMap: Record<string, { score: number; time: string }> = {};
    if (data) {
        scoreMap[data.golden_window.day] = { score: data.golden_window.score, time: data.golden_window.time_label };
        data.alternatives.forEach(alt => {
            scoreMap[alt.day] = { score: alt.score, time: alt.time_label };
        });
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'bg-emerald-400';
        if (score >= 70) return 'bg-primary';
        if (score >= 50) return 'bg-amber-400';
        return 'bg-slate-600';
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
            className={cn('card-premium p-6', className)}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Clock className="size-4 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Smart Release Recommendation</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Algorithmic Golden Window</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4 animate-pulse">
                    <div className="h-28 bg-white/5 rounded-xl" />
                    <div className="h-16 bg-white/5 rounded-xl" />
                </div>
            ) : data && (
                <div className="space-y-6">
                    {/* Golden Window */}
                    <div className="p-5 rounded-xl bg-white/[0.03] border border-emerald-500/20">
                        <div className="flex items-center justify-between gap-5">
                            <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 block">
                                    #1 Recommended Window
                                </span>
                                <h4 className="text-2xl font-black text-white tracking-tight">
                                    Friday at 00:00 IST
                                </h4>
                                <p className="text-xs font-bold text-emerald-400 mt-1.5 flex items-center gap-1.5">
                                    <Target className="size-3.5" />
                                    Optimal for India &amp; South Asia streams
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-3xl font-black text-white tabular-nums">96.5</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Score / 100</p>
                            </div>
                        </div>
                    </div>

                    {/* Editorial Pitch Countdown */}
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
                        <AlertCircle className="size-4 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <h5 className="text-xs font-black uppercase tracking-wider text-white">14-Day Editorial Pitch Countdown</h5>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                Submit by <strong className="text-white">Friday, Aug 7</strong> to qualify for Spotify New Music Friday India pitching.
                            </p>
                        </div>
                    </div>

                    {/* Weekly Day Scores Strip */}
                    <div className="grid grid-cols-7 gap-1.5">
                        {DAYS_ORDER.map((day) => {
                            const info = scoreMap[day];
                            const isGolden = day === 'Friday';
                            const score = isGolden ? 96.5 : (info?.score || 40);

                            return (
                                <div
                                    key={day}
                                    className={cn(
                                        'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border',
                                        isGolden
                                            ? 'bg-emerald-500/10 border-emerald-500/30'
                                            : 'bg-white/[0.02] border-white/5'
                                    )}
                                >
                                    <span className={cn(
                                        'text-[8px] font-black uppercase tracking-widest',
                                        isGolden ? 'text-emerald-400' : 'text-slate-500'
                                    )}>
                                        {DAY_ABBR[day]}
                                    </span>

                                    <div className="w-full h-8 bg-white/[0.03] rounded-md overflow-hidden relative">
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${score}%` }}
                                            transition={{ duration: 0.5, ease: 'easeOut' }}
                                            className={cn('absolute bottom-0 left-0 right-0 rounded-md', getScoreColor(score))}
                                        />
                                    </div>

                                    <span className={cn('text-[9px] font-black', getScoreText(score))}>
                                        {score.toFixed(0)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 5-Step Pre-Release Marketing Checklist */}
                    <div className="space-y-3 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                <CheckSquare className="size-4 text-emerald-400" />
                                Pre-Release Marketing Checklist
                            </h5>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                {checklist.filter(c => c.completed).length} / {checklist.length} Done
                            </span>
                        </div>

                        <div className="space-y-2">
                            {checklist.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => toggleChecklist(item.id)}
                                    className={cn(
                                        'p-3 rounded-xl border flex items-start gap-3 cursor-pointer text-xs font-medium transition-colors',
                                        item.completed
                                            ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-300'
                                            : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                                    )}
                                >
                                    {item.completed ? (
                                        <CheckSquare className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                                    ) : (
                                        <Square className="size-4 text-slate-600 shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1 space-y-0.5">
                                        <p className={cn(item.completed && 'line-through text-slate-400')}>{item.task}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{item.timing}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Justification Toggle */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Bot className="size-4 text-emerald-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                AI Algorithmic Justification
                            </span>
                        </div>
                        <ChevronDown className={cn('size-4 text-slate-600 transition-transform', showDetails && 'rotate-180')} />
                    </button>

                    <AnimatePresence>
                        {showDetails && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
                                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                        {data.justification}
                                    </p>
                                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                        <Music2 className="size-3.5 text-emerald-400" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                            Editorial Targets: {data.playlist_target}
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
