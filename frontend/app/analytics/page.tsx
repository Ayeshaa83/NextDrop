'use client';

import { useRequireAuth } from '@/lib/auth';
import { useDashboard, useMyTracks, formatNumber, formatCurrency } from '@/lib/hooks';
import {
    TrendingUp,
    Zap,
    BarChart3,
    LineChart,
    PieChart,
    Download,
    Target,
    ArrowUpRight,
    ChevronRight,
    Music2,
    Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function AnalyticsDashboard() {
    const { user, artist } = useRequireAuth();
    const { data: dashboard, loading: dashLoading } = useDashboard();
    const { data: tracks, loading: tracksLoading } = useMyTracks();

    const loading = dashLoading || tracksLoading;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="size-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-slate-500 font-medium animate-pulse">Calculating performance metrics...</p>
                </div>
            </div>
        );
    }

    const avgHitScore = dashboard?.average_hit_score ?? 0;
    const totalRevenue = dashboard?.monthly_revenue_prediction ?? 0;
    const totalStreams = dashboard?.total_streams ?? 0;

    const trackItems = tracks?.items || [];
    const topTrack = trackItems.length > 0 ? trackItems[0] : null;
    const hitScoreLabel = avgHitScore >= 80 ? 'Exceptional' : avgHitScore >= 60 ? 'Strong' : avgHitScore >= 40 ? 'Promising' : 'Building';

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
            className="p-8 lg:p-12 max-w-[1600px] mx-auto space-y-10"
        >
            <motion.header variants={item} className="flex justify-between items-end">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Algorithmic Intelligence</p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Deep Analytics</h1>
                </div>
                <div className="flex gap-4">
                    <button className="px-6 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all flex items-center gap-2">
                        <LineChart className="size-4" />
                        Custom Range
                    </button>
                    <button className="px-8 py-3 bg-primary text-white rounded-xl text-sm font-black flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95">
                        <Download className="size-4" />
                        Export Insights
                    </button>
                </div>
            </motion.header>

            <div className="grid grid-cols-12 gap-8">
                {/* Hit Score Radial Gauge */}
                <motion.div variants={item} className="col-span-12 xl:col-span-5 card-premium p-10 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-8 left-10">
                        <h3 className="text-xl font-bold text-white">AI Hit Score</h3>
                        <p className="text-slate-500 text-xs font-medium">Predicted success probability</p>
                    </div>

                    <div className="relative size-64 my-8 group-hover:scale-110 transition-transform duration-700">
                        <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/5" strokeWidth="2.5"></circle>
                            <motion.circle
                                cx="18" cy="18" r="16" fill="none"
                                className="stroke-primary"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                initial={{ strokeDashoffset: 100 }}
                                animate={{ strokeDashoffset: 100 - avgHitScore }}
                                transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                                style={{
                                    strokeDasharray: "100, 100",
                                    filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))'
                                }}
                            ></motion.circle>
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-7xl font-black text-white tracking-tighter">{avgHitScore.toFixed(0)}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-1">{hitScoreLabel}</span>
                        </div>
                    </div>

                    <p className="text-center text-sm font-medium text-slate-400 max-w-xs">
                        {topTrack
                            ? `"${topTrack.title}" is trending above 85% of peers in your genre.`
                            : "Upload more stems to refine your genre-wide success metrics."
                        }
                    </p>
                </motion.div>

                <div className="col-span-12 xl:col-span-7 space-y-8">
                    {/* Growth Chart */}
                    <motion.div variants={item} className="card-premium p-8 h-64 relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    Streaming Velocity
                                    <Target className="size-4 text-secondary" />
                                </h3>
                                <p className="text-slate-500 text-xs font-medium">Real-time engagement growth</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-white">{formatNumber(totalStreams)}</p>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Streams</span>
                            </div>
                        </div>

                        <div className="h-24 w-full mt-4">
                            <svg className="size-full opacity-60" preserveAspectRatio="none" viewBox="0 0 1000 100">
                                <path
                                    d="M0,80 Q150,70 250,90 T450,40 T650,60 T800,10 T1000,20 L1000,100 L0,100 Z"
                                    fill="url(#velocityPremiumGradient)"
                                />
                                <motion.path
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 2, ease: "easeInOut" }}
                                    d="M0,80 Q150,70 250,90 T450,40 T650,60 T800,10 T1000,20"
                                    fill="none"
                                    stroke="#00f2fe"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                                <defs>
                                    <linearGradient id="velocityPremiumGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.2" />
                                        <stop offset="100%" stopColor="#00f2fe" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </motion.div>

                    {/* Financial Blocks */}
                    <div className="grid grid-cols-2 gap-8">
                        {[
                            { label: 'Pending Payout', value: formatCurrency(totalRevenue * 0.15), color: 'text-primary' },
                            { label: 'Lifetime Royalty', value: formatCurrency(totalRevenue), color: 'text-emerald-400' },
                        ].map((fin) => (
                            <motion.div key={fin.label} variants={item} className="card-premium p-6 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{fin.label}</p>
                                <h4 className={cn("text-3xl font-black", fin.color)}>{fin.value}</h4>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full opacity-40", fin.color.replace('text-', 'bg-'))} style={{ width: '70%' }} />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Smart Insights: Your Tracks */}
            <motion.div variants={item} className="mt-12 space-y-6">
                <div className="flex items-center gap-3">
                    <Sparkles className="size-6 text-primary" />
                    <h2 className="text-2xl font-black text-white tracking-tight">Smart Insights</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {trackItems.length === 0 ? (
                        <div className="card-premium p-8 text-center border border-white/5">
                            <p className="text-slate-500 font-medium">No tracks uploaded yet. Go to Upload Release to see Smart Insights.</p>
                        </div>
                    ) : (
                        trackItems.map((t) => (
                            <div key={t.id} className="card-premium p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-white/5 hover:border-primary/20 transition-all">
                                <div>
                                    <h4 className="text-lg font-bold text-white mb-1">{t.title}</h4>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                                        {t.genre || 'Uncategorized'} · {t.bpm ? `${t.bpm} BPM` : 'Unknown BPM'}
                                    </p>
                                </div>
                                
                                <div>
                                    {t.processing_status === 'completed' && t.ai_analysis?.hit_score ? (
                                        <div className="flex items-center gap-3 bg-[#050505] border border-white/5 rounded-xl p-3 pr-5">
                                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <TrendingUp className="size-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Hit Potential</p>
                                                <p className="text-sm font-black text-white">
                                                    {Math.round(t.ai_analysis.hit_score)}<span className="text-primary">%</span>
                                                </p>
                                            </div>
                                        </div>
                                    ) : t.processing_status === 'processing' || t.processing_status === 'pending' ? (
                                        <div className="flex items-center gap-3 bg-[#050505] border border-white/5 rounded-xl p-3 pr-5">
                                            <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center">
                                                <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Generating</p>
                                                <p className="text-sm font-black text-white">Insight...</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <button className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-2">
                                            <Zap className="size-4 text-emerald-400" />
                                            Get AI Insight
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
