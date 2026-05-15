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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, PerformanceInsight } from '@/lib/api';

interface SmartInsightCardProps {
    trackTitle?: string;
    currentStreams?: number;
    previousStreams?: number;
    className?: string;
}

export default function SmartInsightCard({
    trackTitle = 'Neon Nights',
    currentStreams = 24800,
    previousStreams = 18500,
    className,
}: SmartInsightCardProps) {
    const [insight, setInsight] = useState<PerformanceInsight | null>(null);
    const [loading, setLoading] = useState(true);
    const [showTip, setShowTip] = useState(false);

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
                // Fallback mock data if backend is not running
                setInsight({
                    headline: `📈 "${trackTitle}" is gaining momentum`,
                    body: `Your latest track grew 34.1% faster than your previous release! Algorithmic playlists are starting to pick it up.`,
                    trend: 'up',
                    percentage_change: 34.1,
                    tip: 'Share your Spotify link in artist communities and Discord servers to accelerate the algorithmic push.',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchInsight();
    }, [trackTitle, currentStreams, previousStreams]);

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
                'relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-2xl',
                'shadow-[0_0_40px_rgba(99,102,241,0.04)]',
                'group',
                className
            )}
        >
            {/* AI Neon Glow Border Effect */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-primary/20 via-transparent to-emerald-500/20" />
            </div>

            {/* Header */}
            <div className="relative z-10 p-5 pb-0 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Sparkles className="size-4 text-primary" />
                        </div>
                        {/* Neon dot indicator */}
                        <div className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary shadow-[0_0_8px_#6366f1,0_0_16px_#6366f1] animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">Smart Insight</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">AI-Generated</p>
                    </div>
                </div>
                <Bot className="size-4 text-slate-600" />
            </div>

            {/* Content */}
            <div className="relative z-10 p-5 space-y-4">
                {loading ? (
                    <div className="space-y-3 animate-pulse">
                        <div className="h-5 bg-white/5 rounded-lg w-3/4" />
                        <div className="h-3 bg-white/5 rounded-lg w-full" />
                        <div className="h-3 bg-white/5 rounded-lg w-2/3" />
                    </div>
                ) : insight && (
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-4"
                        >
                            {/* Headline */}
                            <h4 className="text-[15px] font-bold text-white leading-snug">
                                {insight.headline}
                            </h4>

                            {/* Metrics Bar */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#050505] border border-white/[0.04]">
                                <div className={cn('size-10 rounded-lg flex items-center justify-center', 
                                    insight.trend === 'up' ? 'bg-emerald-500/10' : insight.trend === 'down' ? 'bg-red-500/10' : 'bg-white/5'
                                )}>
                                    <TrendIcon className={cn('size-5', trendColor)} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Growth Rate</p>
                                    <p className={cn('text-lg font-black', trendColor)}>
                                        {insight.percentage_change > 0 ? '+' : ''}{insight.percentage_change}%
                                    </p>
                                </div>
                                <div className="h-10 w-px bg-white/5" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trend</p>
                                    <p className="text-sm font-bold text-white capitalize">{insight.trend}</p>
                                </div>
                            </div>

                            {/* Body */}
                            <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                {insight.body}
                            </p>

                            {/* AI Tip Toggle */}
                            <button
                                onClick={() => setShowTip(!showTip)}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/70 hover:text-primary transition-colors cursor-pointer group/tip"
                            >
                                <Lightbulb className="size-3.5" />
                                {showTip ? 'Hide' : 'Show'} AI Recommendation
                                <ChevronRight className={cn('size-3 transition-transform', showTip && 'rotate-90')} />
                            </button>

                            <AnimatePresence>
                                {showTip && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                                            <p className="text-xs text-primary-200 leading-relaxed font-medium">
                                                💡 {insight.tip}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>

            {/* Subtle background gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/[0.02] to-transparent pointer-events-none" />
        </motion.div>
    );
}
