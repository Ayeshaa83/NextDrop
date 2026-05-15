'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import {
    Fingerprint,
    Sparkles,
    Bot,
    ChevronDown,
    Waves,
    Music2,
    Zap,
    Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, AudioDNAData, AudioDNACategory } from '@/lib/api';

interface AudioDNARadarProps {
    trackTitle?: string;
    className?: string;
}

// Category icon map
const CATEGORY_ICONS: Record<string, React.ElementType> = {
    Rhythmic: Waves,
    Tonal: Music2,
    Dynamic: Zap,
    Timbral: Palette,
};

// Fallback mock data
const MOCK_DATA: AudioDNAData = {
    track_title: 'Neon Nights',
    overall_quality: 68.4,
    categories: [
        {
            category: 'Rhythmic', color: '#00f2fe',
            features: [
                { name: 'BPM', value: 72, raw_value: 128, unit: 'bpm' },
                { name: 'Onset Rate', value: 65, raw_value: 7.2, unit: 'onsets/s' },
                { name: 'Syncopation', value: 48, raw_value: 0.42, unit: 'idx' },
                { name: 'Beat Strength', value: 81, raw_value: 0.78, unit: 'norm' },
            ],
        },
        {
            category: 'Tonal', color: '#6366f1',
            features: [
                { name: 'Key Clarity', value: 88, raw_value: 0.91, unit: 'corr' },
                { name: 'Chroma Energy', value: 62, raw_value: 0.58, unit: 'norm' },
                { name: 'Spectral Centroid', value: 55, raw_value: 3200, unit: 'Hz' },
                { name: 'Harmonic Ratio', value: 74, raw_value: 0.72, unit: 'ratio' },
            ],
        },
        {
            category: 'Dynamic', color: '#10b981',
            features: [
                { name: 'RMS Energy', value: 67, raw_value: 0.18, unit: 'rms' },
                { name: 'Spectral Rolloff', value: 58, raw_value: 4800, unit: 'Hz' },
                { name: 'Peak Amplitude', value: 85, raw_value: 0.92, unit: 'dBFS' },
                { name: 'Dynamic Range', value: 42, raw_value: 12, unit: 'dB' },
            ],
        },
        {
            category: 'Timbral', color: '#a855f7',
            features: [
                { name: 'MFCC Spread', value: 56, raw_value: 28, unit: 'coeff' },
                { name: 'Zero-Cross Rate', value: 38, raw_value: 0.08, unit: 'rate' },
                { name: 'Brightness', value: 71, raw_value: 0.65, unit: 'norm' },
                { name: 'Roughness', value: 33, raw_value: 0.28, unit: 'idx' },
            ],
        },
    ],
};

// Custom tooltip for the radar
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { feature: string; value: number; raw: number; unit: string; color: string } }> }) {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-[#0a0a0b]/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
            <p className="text-xs font-black text-white mb-1">{d.feature}</p>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Score</span>
                </div>
                <span className="text-sm font-black text-white">{d.value}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
                Raw: {d.raw} {d.unit}
            </p>
        </div>
    );
}

export default function AudioDNARadar({ trackTitle = 'Neon Nights', className }: AudioDNARadarProps) {
    const [data, setData] = useState<AudioDNAData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await aiApi.getAudioDNA(trackTitle);
                setData(result);
            } catch {
                setData(MOCK_DATA);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [trackTitle]);

    // Build radar chart data from all 16 features
    const radarData = useMemo(() => {
        if (!data) return [];
        return data.categories.flatMap(cat =>
            cat.features.map(f => ({
                feature: f.name,
                value: f.value,
                raw: f.raw_value,
                unit: f.unit,
                color: cat.color,
                category: cat.category,
                fullMark: 100,
            }))
        );
    }, [data]);

    // Filtered data when a category is active
    const filteredData = useMemo(() => {
        if (!activeCategory) return radarData;
        return radarData.map(d =>
            d.category === activeCategory ? d : { ...d, value: 0 }
        );
    }, [radarData, activeCategory]);

    const getQualityLabel = (q: number) => {
        if (q >= 80) return 'Exceptional';
        if (q >= 65) return 'Strong';
        if (q >= 50) return 'Promising';
        return 'Developing';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={cn(
                'relative overflow-hidden rounded-3xl',
                'border border-white/[0.06] bg-[#070708]/90 backdrop-blur-2xl',
                'shadow-[0_0_60px_rgba(99,102,241,0.04)]',
                className
            )}
        >
            {/* Ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-primary/[0.03] rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 p-6 pb-3 flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-white/[0.06]">
                            <Fingerprint className="size-5 text-primary" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary shadow-[0_0_8px_#6366f1,0_0_16px_#6366f1] animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white">Audio DNA</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">16 ML-Extracted Features</p>
                    </div>
                </div>

                {data && (
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Quality</p>
                        <p className="text-lg font-black text-white">
                            {data.overall_quality.toFixed(0)}
                            <span className="text-xs text-slate-500 ml-0.5">/ 100</span>
                        </p>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="p-8 flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                        <div className="size-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Extracting Audio DNA...</p>
                    </div>
                </div>
            ) : data && (
                <div className="relative z-10">
                    {/* Category Toggle Pills */}
                    <div className="flex items-center gap-2 px-6 pt-4 pb-2 overflow-x-auto">
                        <button
                            onClick={() => setActiveCategory(null)}
                            className={cn(
                                'shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer',
                                !activeCategory
                                    ? 'bg-white/10 border-white/20 text-white'
                                    : 'bg-white/[0.02] border-white/[0.04] text-slate-500 hover:text-white'
                            )}
                        >
                            All 16
                        </button>
                        {data.categories.map(cat => {
                            const Icon = CATEGORY_ICONS[cat.category] || Sparkles;
                            return (
                                <button
                                    key={cat.category}
                                    onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
                                    className={cn(
                                        'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer',
                                        activeCategory === cat.category
                                            ? 'border-current text-white'
                                            : 'bg-white/[0.02] border-white/[0.04] text-slate-500 hover:text-white'
                                    )}
                                    style={activeCategory === cat.category ? {
                                        background: `${cat.color}15`,
                                        borderColor: `${cat.color}40`,
                                        color: cat.color,
                                    } : {}}
                                >
                                    <Icon className="size-3" />
                                    {cat.category}
                                </button>
                            );
                        })}
                    </div>

                    {/* Radar Chart */}
                    <div className="px-2 py-2">
                        <ResponsiveContainer width="100%" height={340}>
                            <RadarChart data={filteredData} cx="50%" cy="50%" outerRadius="75%">
                                <PolarGrid
                                    stroke="rgba(255,255,255,0.04)"
                                    strokeDasharray="2 4"
                                />
                                <PolarAngleAxis
                                    dataKey="feature"
                                    tick={{
                                        fill: '#64748b',
                                        fontSize: 9,
                                        fontWeight: 900,
                                    }}
                                    tickLine={false}
                                />
                                <PolarRadiusAxis
                                    domain={[0, 100]}
                                    tick={false}
                                    axisLine={false}
                                />
                                <Radar
                                    dataKey="value"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fill="url(#dnaGradient)"
                                    fillOpacity={0.3}
                                    dot={{
                                        r: 3,
                                        fill: '#6366f1',
                                        stroke: '#050505',
                                        strokeWidth: 2,
                                    }}
                                    animationDuration={1200}
                                    animationEasing="ease-out"
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <defs>
                                    <radialGradient id="dnaGradient" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                                        <stop offset="50%" stopColor="#00f2fe" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.1} />
                                    </radialGradient>
                                </defs>
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Category Detail Cards */}
                    <div className="px-5 pb-5">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-white/[0.04] hover:border-primary/15 transition-all cursor-pointer mb-3"
                        >
                            <div className="flex items-center gap-2">
                                <Bot className="size-3.5 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Feature Breakdown</span>
                            </div>
                            <ChevronDown className={cn('size-3.5 text-slate-600 transition-transform', showDetails && 'rotate-180')} />
                        </button>

                        <AnimatePresence>
                            {showDetails && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-2 gap-3">
                                        {data.categories.map((cat, ci) => {
                                            const Icon = CATEGORY_ICONS[cat.category] || Sparkles;
                                            return (
                                                <motion.div
                                                    key={cat.category}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: ci * 0.08 }}
                                                    className="p-3 rounded-xl bg-[#050505] border border-white/[0.04] space-y-2.5"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="size-3.5" style={{ color: cat.color }} />
                                                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: cat.color }}>
                                                            {cat.category}
                                                        </span>
                                                    </div>
                                                    {cat.features.map((f, fi) => (
                                                        <div key={f.name} className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-slate-400">{f.name}</span>
                                                                <span className="text-[10px] font-black text-white">{f.value}</span>
                                                            </div>
                                                            <div className="h-1 w-full bg-white/[0.03] rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${f.value}%` }}
                                                                    transition={{ duration: 0.8, delay: 0.1 + ci * 0.08 + fi * 0.04 }}
                                                                    className="h-full rounded-full"
                                                                    style={{
                                                                        background: `linear-gradient(90deg, ${cat.color}80, ${cat.color})`,
                                                                        boxShadow: `0 0 6px ${cat.color}40`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <p className="text-[8px] font-black tracking-widest text-slate-600 uppercase">
                                                                {f.raw_value} {f.unit}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
