'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    TrendingUp,
    TrendingDown,
    Minus,
    Lightbulb,
    Bot,
    ChevronRight,
    Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, PerformanceInsight } from '@/lib/api';

interface SmartInsightCardProps {
    trackId?: string;
    trackTitle?: string;
    currentStreams?: number;
    previousStreams?: number;
    fallbackInsight?: PerformanceInsight;
    className?: string;
}

export default function SmartInsightCard({
    trackId,
    trackTitle = 'Neon Drive',
    currentStreams = 24800,
    previousStreams = 13400,
    fallbackInsight,
    className,
}: SmartInsightCardProps) {
    const [insight, setInsight] = useState<PerformanceInsight | null>(null);
    const [loading, setLoading] = useState(true);
    const [showTip, setShowTip] = useState(true);

    useEffect(() => {
        const fetchInsight = async () => {
            try {
                const data = await aiApi.getPerformanceInsight({
                    track_title: trackTitle,
                    current_streams: currentStreams,
                    previous_streams: previousStreams,
                });
                setInsight(data);
            } catch {
                // Fallback mock aligned with viral TikTok UGC surge wireframe
                setInsight(fallbackInsight ?? {
                    headline: `TikTok UGC Surge Driving +85% Streams`,
                    body: `Your track "${trackTitle}" experienced an 85% velocity spike driven by short-form video creations in North India & Maharashtra. (100% Confidence)`,
                    trend: 'up',
                    percentage_change: 85.0,
                    tip: 'Pin top viral clips on Instagram Reels & TikTok, and run a 48-hour social duet challenge to maximize playlist conversions.',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchInsight();
    }, [trackId, trackTitle, currentStreams, previousStreams]);

    const TrendIcon = insight?.trend === 'up' ? TrendingUp : insight?.trend === 'down' ? TrendingDown : Minus;
    const trendColor = insight?.trend === 'up'
        ? 'text-emerald-400'
        : insight?.trend === 'down'
            ? 'text-red-400'
            : 'text-slate-400';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
                'relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur-2xl',
                'shadow-[0_0_50px_rgba(99,102,241,0.05)]',
                'group',
                className
            )}
        >
            {/* AI Glow Hover Border */}
            <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                <div className="absolute -inset-px rounded-3xl bg-gradient-to-r from-primary/30 via-cyan-500/20 to-emerald-500/30" />
            </div>

            {/* Header */}
            <div className="relative z-10 p-6 pb-4 flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Sparkles className="size-4 text-primary" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary shadow-[0_0_8px_#6366f1,0_0_16px_#6366f1] animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.15em] text-primary">AI Strategic Insight</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Autonomous Trend Engine</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <Flame className="size-3 text-amber-400 animate-bounce" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">100% Confidence</span>
                </div>
            </div>

            {/* Content */}
            <div className="relative z-10 p-6 space-y-5">
                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-6 bg-white/5 rounded-lg w-3/4" />
                        <div className="h-4 bg-white/5 rounded-lg w-full" />
                        <div className="h-16 bg-white/5 rounded-xl w-full" />
                    </div>
                ) : insight && (
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-5"
                        >
                            {/* Headline */}
                            <h4 className="text-xl font-black text-white leading-snug tracking-tight flex items-center gap-2">
                                {insight.headline}
                            </h4>

                            {/* Metrics Bar */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#050505] border border-white/[0.04]">
                                <div className="flex items-center gap-3">
                                    <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0',
                                        insight.trend === 'up' ? 'bg-emerald-500/10 border border-emerald-500/20' : insight.trend === 'down' ? 'bg-red-500/10' : 'bg-white/5'
                                    )}>
                                        <TrendIcon className={cn('size-5', trendColor)} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Growth Rate</p>
                                        <p className={cn('text-lg font-black', trendColor)}>
                                            {insight.percentage_change > 0 ? '+' : ''}{insight.percentage_change}%
                                        </p>
                                    </div>
                                </div>

                                <div className="p-2 border-l border-white/[0.04] pl-4">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Trajectory</p>
                                    <p className="text-sm font-bold text-white capitalize">{insight.trend}ward Velocity</p>
                                </div>

                                <div className="p-2 border-l border-white/[0.04] pl-4 col-span-2 md:col-span-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Primary Channel</p>
                                    <p className="text-sm font-bold text-primary">Reels & TikTok UGC</p>
                                </div>
                            </div>

                            {/* Body */}
                            <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                {insight.body}
                            </p>

                            {/* Strategy Tip */}
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-cyan-500/10 border border-primary/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                                        <Lightbulb className="size-3.5 text-amber-400" />
                                        Actionable Strategy Tip:
                                    </span>
                                </div>
                                <p className="text-xs text-slate-200 font-semibold leading-relaxed">
                                    {insight.tip}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </motion.div>
    );
}

