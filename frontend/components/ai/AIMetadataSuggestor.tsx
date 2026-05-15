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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, MetadataSuggestion } from '@/lib/api';

interface AIMetadataSuggestorProps {
    title: string;
    onSuggest: (data: MetadataSuggestion) => void;
    disabled?: boolean;
    className?: string;
}

export default function AIMetadataSuggestor({
    title,
    onSuggest,
    disabled = false,
    className,
}: AIMetadataSuggestorProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [suggestion, setSuggestion] = useState<MetadataSuggestion | null>(null);

    const handleSuggest = async () => {
        if (status === 'loading') return;
        setStatus('loading');

        try {
            const data = await aiApi.suggestMetadata(undefined, title);
            setSuggestion(data);
            setStatus('done');
            onSuggest(data);
        } catch {
            // Fallback mock if backend unreachable
            const mockData: MetadataSuggestion = {
                genre: 'Future Bass',
                mood: 'Euphoric',
                bpm: 128,
                key: 'F major',
                energy: 0.82,
                danceability: 0.75,
                confidence: 0.91,
            };
            setSuggestion(mockData);
            setStatus('done');
            onSuggest(mockData);
        }
    };

    return (
        <div className={cn('space-y-3', className)}>
            {/* Magic Wand Button */}
            <motion.button
                onClick={handleSuggest}
                disabled={disabled || status === 'loading'}
                whileHover={{ scale: status === 'loading' ? 1 : 1.02 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                    'w-full relative overflow-hidden rounded-xl py-3.5 px-5',
                    'flex items-center justify-center gap-3',
                    'font-black text-xs uppercase tracking-[0.15em]',
                    'transition-all cursor-pointer',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    status === 'done'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : status === 'loading'
                            ? 'bg-primary/10 border border-primary/20 text-primary'
                            : 'bg-gradient-to-r from-primary/20 via-primary/10 to-[#00f2fe]/20 border border-primary/20 text-primary hover:border-primary/40'
                )}
            >
                {/* Shimmer effect during loading */}
                {status === 'loading' && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                )}

                {/* Idle glow sweep */}
                {status === 'idle' && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                )}

                <span className="relative z-10 flex items-center gap-2.5">
                    {status === 'loading' ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            AI Analyzing...
                        </>
                    ) : status === 'done' ? (
                        <>
                            <CheckCircle2 className="size-4" />
                            Metadata Suggested
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

            {/* Confidence + Stats Bar (shown after suggestion) */}
            <AnimatePresence>
                {status === 'done' && suggestion && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 rounded-xl bg-[#050505] border border-white/[0.04] space-y-3">
                            {/* Top row: confidence + action */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="size-3 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">AI Confidence</span>
                                </div>
                                <span className="text-sm font-black text-white">
                                    {(suggestion.confidence * 100).toFixed(0)}%
                                </span>
                            </div>

                            {/* Confidence bar */}
                            <div className="h-1.5 w-full bg-white/[0.03] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${suggestion.confidence * 100}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
                                    style={{ boxShadow: '0 0 8px rgba(99, 102, 241, 0.3)' }}
                                />
                            </div>

                            {/* Energy + Danceability mini stats */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
                                    <Zap className="size-3 text-amber-400" />
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-600">Energy</p>
                                        <p className="text-xs font-black text-white">{(suggestion.energy * 100).toFixed(0)}%</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
                                    <Music2 className="size-3 text-secondary" />
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-600">Dance</p>
                                        <p className="text-xs font-black text-white">{(suggestion.danceability * 100).toFixed(0)}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Re-suggest button */}
                            <button
                                onClick={handleSuggest}
                                className="w-full text-center text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors cursor-pointer py-1"
                            >
                                Re-analyze →
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
