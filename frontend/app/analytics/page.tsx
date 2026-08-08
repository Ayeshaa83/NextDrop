'use client';

import { useState } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useDashboard, useTimeseries, useTerritories, formatNumber } from '@/lib/hooks';
import {
    LineChart, Download, Sparkles, Globe2, AlertCircle, PlayCircle, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import SmartInsightCard from '@/components/ai/SmartInsightCard';
import ReleaseTimerDial from '@/components/ai/ReleaseTimerDial';
import TerritoryGrowthMap from '@/components/ai/TerritoryGrowthMap';
import AudioDNARadar from '@/components/ai/AudioDNARadar';

// ISO country code -> display name
const countryName = (code: string) => {
    try {
        return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
    } catch {
        return code;
    }
};

const DEFAULT_PLATFORM_DATA = [
    { name: 'Spotify', value: 45, color: '#1DB954' },
    { name: 'Apple Music', value: 25, color: '#fa243c' },
    { name: 'YouTube', value: 15, color: '#FF0000' },
    { name: 'Instagram', value: 15, color: '#E1306C' },
];

const PLATFORM_COLORS: Record<string, string> = {
    'Spotify': '#1DB954',
    'YouTube': '#FF0000',
    'Apple Music': '#fa243c',
    'Instagram': '#E1306C',
    'TikTok': '#00f2fe'
};

export default function AnalyticsDashboard() {
    const { user } = useRequireAuth();
    const { data: dashboard, loading } = useDashboard();
    const { data: timeseries } = useTimeseries(30);
    const { data: territoryData } = useTerritories();
    const [showRegionWhy, setShowRegionWhy] = useState<string | null>(null);

    // Real streams-over-time points from analytics snapshots
    const trajectoryData = (timeseries?.points || []).map(p => ({
        day: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        streams: p.total,
        youtube: p.youtube || 0,
        spotify: p.spotify || 0,
    }));

    // Week-over-week growth from the same series
    const points = timeseries?.points || [];
    const lastWeek = points.slice(-7).reduce((s, p) => s + p.total, 0);
    const prevWeek = points.slice(-14, -7).reduce((s, p) => s + p.total, 0);
    const weekGrowth = prevWeek > 0 ? ((lastWeek - prevWeek) / prevWeek) * 100 : null;

    const territories = territoryData?.territories || [];

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };
    
    // Transform backend dict to recharts array
    const platformData = dashboard?.platform_breakdown 
        ? Object.entries(dashboard.platform_breakdown)
            .filter(([_, val]) => val > 0)
            .map(([name, value]) => ({
                name,
                value,
                color: PLATFORM_COLORS[name] || '#8884d8'
            }))
        : DEFAULT_PLATFORM_DATA;

    if (loading) return <div className="flex h-[calc(100vh-80px)] items-center justify-center"><div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="p-8 lg:p-12 max-w-[1600px] mx-auto space-y-10">
            {/* Header */}
            <motion.header variants={item} className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase flex items-center gap-2">
                        <Sparkles className="size-3" /> Algorithmic Intelligence
                    </p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Deep Analytics</h1>
                </div>
                <div className="flex gap-4">
                    <button className="px-6 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all flex items-center gap-2">
                        <LineChart className="size-4" /> Custom Range
                    </button>
                    <button className="px-8 py-3 bg-white text-black hover:scale-105 active:scale-95 transition-transform rounded-xl text-sm font-black flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        <Download className="size-4" /> Export Report
                    </button>
                </div>
            </motion.header>

            {/* 1. AI Command Center — live components backed by /api/ai */}
            <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Smart Release Timer (data-driven golden window) */}
                <ReleaseTimerDial className="col-span-1 xl:col-span-4" />

                {/* AI Insights */}
                <div className="col-span-1 xl:col-span-8 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        Natural Language Insights
                        <span className="text-[9px] font-black uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/20">AI-Generated</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                        <SmartInsightCard
                            trackTitle="Catalog Performance"
                            currentStreams={lastWeek || dashboard?.total_streams || 0}
                            previousStreams={prevWeek || 0}
                        />
                        <TerritoryGrowthMap />
                    </div>
                </div>
            </motion.div>

            {/* Audio DNA Signature Section */}
            <motion.div variants={item}>
                <AudioDNARadar trackTitle="Neon Drive" />
            </motion.div>

            {/* 2. API-Driven Performance Suite */}
            <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Global Stream Trajectory */}
                <div className="col-span-1 xl:col-span-2 card-premium p-8 relative overflow-hidden flex flex-col">
                    <div className="flex justify-between items-start mb-8 z-10">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                Global Stream Trajectory
                            </h3>
                            <p className="text-slate-500 text-xs font-medium focus:outline-none">Live velocity vs Predictive model</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-black text-white">{formatNumber(dashboard?.total_streams || 0)}</p>
                            {weekGrowth !== null && (
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest",
                                    weekGrowth >= 0 ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {weekGrowth >= 0 ? '+' : ''}{weekGrowth.toFixed(1)}% vs last week
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="h-[300px] w-full -ml-4 z-10">
                        {trajectoryData.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
                                <LineChart className="size-8 text-slate-600" />
                                <p className="text-sm text-slate-500 font-medium max-w-sm">
                                    No stream history yet. Distribute a track and refresh platform analytics
                                    (or run a simulation) to start building your trajectory.
                                </p>
                            </div>
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trajectoryData}>
                                <defs>
                                    <linearGradient id="colorStreams" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorSpotify" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1DB954" stopOpacity={0.25}/>
                                        <stop offset="95%" stopColor="#1DB954" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="day" stroke="#334155" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="#334155" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000)}k` : v} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}
                                    itemStyle={{ color: '#fff' }} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="spotify" stroke="#1DB954" fillOpacity={1} fill="url(#colorSpotify)" name="Spotify" strokeWidth={2} />
                                <Area type="monotone" dataKey="streams" stroke="#6366f1" fillOpacity={1} fill="url(#colorStreams)" name="Total Streams" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Right Column: Platform & Geography */}
                <div className="col-span-1 flex flex-col gap-8">
                    {/* Platform Distribution */}
                    <div className="card-premium p-6 flex flex-col flex-1 border border-white/5">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Platform Share</h3>
                        <div className="flex-1 flex items-center justify-between">
                            <div className="h-32 w-1/2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={platformData} innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                                            {platformData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-1/2 space-y-3">
                                {platformData.map(p => (
                                    <div key={p.name} className="flex items-center gap-2">
                                        <div className="size-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                                        <span className="text-xs font-bold text-white flex-1">{p.name}</span>
                                        <span className="text-[10px] font-black text-slate-400">{p.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Geographic Heatmap */}
                    <div className="card-premium p-6 border border-white/5 relative">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <Globe2 className="size-4" /> Top Territories
                            </h3>
                        </div>
                        
                        <div className="space-y-1">
                            {territories.length === 0 ? (
                                <p className="text-xs text-slate-500 font-medium py-4 text-center">
                                    No country-level data yet. Territory stats appear once your streams
                                    include regional attribution.
                                </p>
                            ) : territories.slice(0, 5).map(region => (
                                <div key={region.country} className="relative group/territory rounded-xl p-3 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-white flex items-center gap-2">
                                            <MapPin className="size-3 text-slate-500" /> {countryName(region.country)}
                                        </span>
                                        <div className="flex items-center gap-4">
                                            <span className={cn(
                                                "text-xs font-black",
                                                region.growth_percentage >= 0 ? "text-emerald-400" : "text-red-400"
                                            )}>
                                                {region.growth_percentage >= 0 ? '↑' : '↓'} {Math.abs(region.growth_percentage)}%
                                            </span>
                                            <button
                                                onClick={() => setShowRegionWhy(showRegionWhy === region.country ? null : region.country)}
                                                className="text-[9px] uppercase font-black px-2 py-1 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                                            >
                                                Details
                                            </button>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {showRegionWhy === region.country && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden mt-2"
                                            >
                                                <div className="p-3 bg-[#050505] rounded-lg border border-primary/20 text-xs text-primary-100 font-medium leading-relaxed">
                                                    {formatNumber(region.streams)} streams in the last 30 days
                                                    {region.previous_streams > 0 && (
                                                        <> (vs {formatNumber(region.previous_streams)} the previous month)</>
                                                    )}.
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 3. The Action Center */}
            <motion.div variants={item} className="mt-12 space-y-6">
                <div className="flex items-center gap-3">
                    <AlertCircle className="size-6 text-[#ff2a5f]" />
                    <h2 className="text-2xl font-black text-white tracking-tight">Next Strategic Moves</h2>
                </div>
                
                <div className="card-premium overflow-hidden border border-[#ff2a5f]/10">
                    {/* Action 1 */}
                    <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-[#ff2a5f]/5 transition-colors relative group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff2a5f] scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                        <div>
                            <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                                High engagement detected at 0:45
                                <span className="text-emerald-400">→</span>
                            </p>
                            <p className="text-xs font-medium text-slate-400">
                                This section has a high replay matrix. Ideal for short-form video.
                            </p>
                        </div>
                        <button className="px-5 py-3 bg-[#ff2a5f] hover:bg-[#ff2a5f]/80 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-[0_0_15px_rgba(255,42,95,0.3)] shrink-0 flex items-center gap-2">
                            <PlayCircle className="size-4" /> Create 15s Snippet
                        </button>
                    </div>

                    {/* Action 2 */}
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-white/5 transition-colors relative group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                        <div>
                            <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                                Low retention at 2:10
                                <span className="text-emerald-400">→</span>
                            </p>
                            <p className="text-xs font-medium text-slate-400">
                                Drop in listener focus. The bridge arrangement extends past algorithmic norms.
                            </p>
                        </div>
                        <button className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors shrink-0">
                            Adjust Arrangement
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
