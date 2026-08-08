'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wand2,
    Loader2,
    CheckCircle2,
    Sparkles,
    Zap,
    Music2,
    Tag,
    Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, MetadataSuggestion } from '@/lib/api';

export interface AIMetadataSuggestorProps {
    title: string;
    onSuggest?: (data: MetadataSuggestion) => void;
    onAddChip?: (tag: string, type: 'genre' | 'mood') => void;
    disabled?: boolean;
    className?: string;
}

export interface TagChip {
    id: string;
    label: string;
    type: 'genre' | 'mood';
    added?: boolean;
}

export default function AIMetadataSuggestor({
    title,
    onSuggest,
    onAddChip,
    disabled = false,
    className,
}: AIMetadataSuggestorProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [suggestion, setSuggestion] = useState<MetadataSuggestion | null>(null);
    const [qualityScore, setQualityScore] = useState<number>(85);
    const [chips, setChips] = useState<TagChip[]>([
        { id: '1', label: 'Hindi Indie', type: 'genre', added: false },
        { id: '2', label: 'Energetic', type: 'mood', added: false },
        { id: '3', label: 'Melancholic', type: 'mood', added: false },
        { id: '4', label: 'Future Bass', type: 'genre', added: false },
    ]);

    const handleSuggest = async () => {
        if (status === 'loading') return;
        setStatus('loading');

        try {
            const data = await aiApi.suggestMetadata(undefined, title);
            setSuggestion(data);
            const score = Math.round((data.confidence || 0.85) * 100);
            setQualityScore(score);
            setStatus('done');
            if (onSuggest) onSuggest(data);

            // Update tag chips based on LLM response
            setChips([
                { id: 'c1', label: data.genre || 'Hindi Indie', type: 'genre', added: false },
                { id: 'c2', label: data.mood || 'Energetic', type: 'mood', added: false },
                { id: 'c3', label: 'Urban Desi', type: 'genre', added: false },
                { id: 'c4', label: 'Euphoric', type: 'mood', added: false },
            ]);
        } catch {
            // Fallback mock if backend is unreachable
            const mockData: MetadataSuggestion = {
                genre: 'Hindi Indie',
                mood: 'Energetic',
                bpm: 128,
                key: 'F major',
                energy: 0.85,
                danceability: 0.78,
                confidence: 0.85,
            };
            setSuggestion(mockData);
            setQualityScore(85);
            setStatus('done');
            if (onSuggest) onSuggest(mockData);
            setChips([
                { id: 'c1', label: 'Hindi Indie', type: 'genre', added: false },
                { id: 'c2', label: 'Energetic', type: 'mood', added: false },
                { id: 'c3', label: 'Chill Hop', type: 'genre', added: false },
                { id: 'c4', label: 'Euphoric', type: 'mood', added: false },
            ]);
        }
    };

    const handleChipClick = (chip: TagChip) => {
        setChips(prev => prev.map(c => c.id === chip.id ? { ...c, added: true } : c));
        if (onAddChip) {
            onAddChip(chip.label, chip.type);
        } else if (onSuggest && suggestion) {
            if (chip.type === 'genre') {
                onSuggest({ ...suggestion, genre: chip.label });
            } else {
                onSuggest({ ...suggestion, mood: chip.label });
            }
        }
    };

    const getScoreRating = (score: number) => {
        if (score >= 80) return { label: 'Good', color: 'text-emerald-400', bar: 'from-emerald-500 to-teal-400' };
        if (score >= 60) return { label: 'Moderate', color: 'text-amber-400', bar: 'from-amber-500 to-yellow-400' };
        return { label: 'Needs Tags', color: 'text-red-400', bar: 'from-red-500 to-pink-500' };
    };

    const rating = getScoreRating(qualityScore);

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header + Main Button */}
            <motion.button
                onClick={handleSuggest}
                disabled={disabled || status === 'loading'}
                whileHover={{ scale: status === 'loading' ? 1 : 1.02 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                    'w-full relative overflow-hidden rounded-xl py-3.5 px-5',
                    'flex items-center justify-center gap-3',
                    'font-black text-xs uppercase tracking-[0.15em]',
                    'transition-all cursor-pointer shadow-lg',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    status === 'done'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                        : status === 'loading'
                            ? 'bg-primary/10 border border-primary/20 text-primary'
                            : 'bg-gradient-to-r from-primary/20 via-primary/10 to-[#00f2fe]/20 border border-primary/30 text-primary hover:border-primary/50 hover:shadow-[0_0_25px_rgba(99,102,241,0.2)]'
                )}
            >
                {/* Shimmer effect during loading */}
                {status === 'loading' && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                )}

                {/* Idle glow sweep */}
                {status === 'idle' && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                )}

                <span className="relative z-10 flex items-center gap-2.5">
                    {status === 'loading' ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            AI Scanning Metadata...
                        </>
                    ) : status === 'done' ? (
                        <>
                            <CheckCircle2 className="size-4" />
                            Metadata Quality Analyzed
                        </>
                    ) : (
                        <>
                            <Wand2 className="size-4" />
                            <Sparkles className="size-3 opacity-60" />
                            Smart-Fill Metadata
                        </>
                    )}
                </span>
            </motion.button>

            {/* Quality Score Bar + 1-Click Tag Chips Panel */}
            <AnimatePresence>
                {(status === 'done' || status === 'idle') && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 rounded-2xl bg-[#070708] border border-white/[0.06] space-y-4 shadow-xl">
                            {/* Score Row */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="size-3.5 text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            AI Metadata Quality Score
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-white">
                                            {qualityScore} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                                        </span>
                                        <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/5 border border-white/5", rating.color)}>
                                            ({rating.label})
                                        </span>
                                    </div>
                                </div>

                                {/* Score Bar */}
                                <div className="h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden p-0.5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${qualityScore}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className={cn("h-full rounded-full bg-gradient-to-r", rating.bar)}
                                        style={{ boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)' }}
                                    />
                                </div>
                            </div>

                            {/* 1-Click Tag Chips */}
                            <div className="space-y-2 pt-1 border-t border-white/[0.04]">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <Tag className="size-3 text-primary" />
                                    AI Suggestions (1-Click Auto-Fill):
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {chips.map(chip => (
                                        <motion.button
                                            key={chip.id}
                                            onClick={() => handleChipClick(chip)}
                                            disabled={chip.added}
                                            whileHover={{ scale: chip.added ? 1 : 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
                                                chip.added
                                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default"
                                                    : "bg-white/[0.03] text-slate-300 border-white/10 hover:border-primary/40 hover:text-white hover:bg-primary/10"
                                            )}
                                        >
                                            {chip.added ? (
                                                <CheckCircle2 className="size-3 text-emerald-400" />
                                            ) : (
                                                <Plus className="size-3 text-primary" />
                                            )}
                                            <span>+ Add &quot;{chip.label}&quot;</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Extra Feature Mini Badges */}
                            {suggestion && (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                                        <Zap className="size-3.5 text-amber-400" />
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Energy</p>
                                            <p className="text-xs font-black text-white">{Math.round(suggestion.energy * 100)}%</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                                        <Music2 className="size-3.5 text-cyan-400" />
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Danceability</p>
                                            <p className="text-xs font-black text-white">{Math.round(suggestion.danceability * 100)}%</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

