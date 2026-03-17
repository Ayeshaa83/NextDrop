'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { storageApi, tracksApi, analyzeApi, AnalyzeResult, ApiError } from '@/lib/api';
import {
    UploadCloud,
    Music,
    XCircle,
    Sparkles,
    FileAudio,
    ChevronRight,
    Loader2,
    CheckCircle2,
    TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Shimmer placeholder for AI-filling fields ─────────────────────────

function ShimmerField({ label }: { label: string }) {
    return (
        <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                {label}
            </label>
            <div className="relative w-full h-[52px] bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="absolute inset-0 flex items-center px-5">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="size-3.5 animate-spin text-primary/60" />
                        <span className="text-xs font-medium text-primary/60">Smart-filling...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Hit Potential Badge ────────────────────────────────────────────────

function HitBadge({ score }: { score: number }) {
    const label = score >= 75 ? 'High' : score >= 50 ? 'Promising' : score >= 30 ? 'Moderate' : 'Niche';
    const color = score >= 75 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
        : score >= 50 ? 'text-primary border-primary/30 bg-primary/10'
            : 'text-slate-400 border-white/10 bg-white/5';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider',
                color
            )}
        >
            <TrendingUp className="size-3" />
            Hit Potential: {Math.round(score)}% · {label}
        </motion.div>
    );
}

// ─── Radial Gauge ────────────────────────────────────────────────────────

function RadialGauge({ score }: { score: number }) {
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    // Determine color based on score
    const color = score >= 75 ? '#10b981' : score >= 50 ? '#6366f1' : '#94a3b8';
    
    return (
        <div className="group relative flex flex-col items-center justify-center">
            {/* Tooltip */}
            <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-xl border border-white/10 text-white text-[10px] uppercase font-black tracking-widest px-4 py-2 rounded-lg whitespace-nowrap z-10 pointers-events-none">
                Predictive score based on 2025 streaming trends.
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-t-4 border-t-white/10 border-x-4 border-x-transparent w-0 h-0" />
            </div>

            <div className="relative size-40 flex items-center justify-center">
                {/* Background Track */}
                <svg className="absolute inset-0 size-full -rotate-90">
                    <circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                    {/* Progress Fill */}
                    <motion.circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                        className="drop-shadow-[0_0_12px_currentColor]"
                    />
                </svg>
                <div className="text-center absolute">
                    <motion.span 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1 }}
                        className="block text-4xl font-black text-white tracking-tighter"
                    >
                        {Math.round(score)}<span className="text-lg text-slate-500">%</span>
                    </motion.span>
                    <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Hit Potential</span>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function UploadReleasePage() {
    const { user, artist } = useRequireAuth();

    // File state
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [genre, setGenre] = useState('');
    const [bpm, setBpm] = useState('');
    const [musicalKey, setMusicalKey] = useState('');
    const [mood, setMood] = useState('');

    // AI state
    const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'done' | 'error'>('idle');
    const [aiResult, setAiResult] = useState<AnalyzeResult | null>(null);
    const [aiError, setAiError] = useState('');

    // Publish state
    const [publishStatus, setPublishStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [publishProgress, setPublishProgress] = useState(0);
    const [publishError, setPublishError] = useState('');

    // ─── File Handling ──────────────────────────────────────────────

    const onFileSelected = useCallback((selectedFile: File) => {
        setFile(selectedFile);
        if (!title) {
            setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
        }

        // Immediately trigger AI analysis in the background
        setAiStatus('analyzing');
        setAiResult(null);
        setAiError('');

        analyzeApi.analyzeFile(selectedFile)
            .then((result) => {
                setAiResult(result);
                setAiStatus('done');

                // Auto-fill fields (only if user hasn't manually typed)
                if (result.genre?.[0]?.name) setGenre(prev => prev || result.genre[0].name);
                if (result.bpm) setBpm(prev => prev || String(Math.round(result.bpm!)));
                if (result.key) setMusicalKey(prev => prev || result.key!);
                if (result.mood?.[0]?.name) setMood(prev => prev || result.mood[0].name);
            })
            .catch((err) => {
                setAiStatus('error');
                setAiError(err instanceof ApiError ? err.message : 'AI analysis unavailable');
            });
    }, [title]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped && dropped.type.startsWith('audio/')) {
            onFileSelected(dropped);
        }
    }, [onFileSelected]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected && selected.type.startsWith('audio/')) {
            onFileSelected(selected);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ─── Publish Flow ───────────────────────────────────────────────

    const getAudioDuration = (f: File): Promise<number> => {
        return new Promise((resolve) => {
            const objectUrl = URL.createObjectURL(f);
            const audio = new Audio(objectUrl);
            audio.addEventListener('loadedmetadata', () => {
                resolve(audio.duration);
                URL.revokeObjectURL(objectUrl);
            });
        });
    };

    const handlePublish = async () => {
        if (!file || !title) return;

        setPublishError('');
        setPublishStatus('uploading');
        setPublishProgress(10);

        try {
            const duration = await getAudioDuration(file);

            setPublishProgress(25);
            const uploadReq = await storageApi.getUploadUrl({
                filename: file.name,
                category: 'tracks',
                content_type: file.type || 'audio/mpeg'
            });

            setPublishProgress(50);
            await fetch(uploadReq.upload_url, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type || 'audio/mpeg' }
            });

            setPublishProgress(80);
            await tracksApi.createTrack({
                title,
                duration: Math.floor(duration),
                file_url: uploadReq.file_url,
                is_public: false,
                genre: genre || null,
                bpm: bpm ? parseInt(bpm) : null,
            });

            setPublishProgress(100);
            setPublishStatus('done');
        } catch (err) {
            setPublishStatus('error');
            setPublishError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
        }
    };

    const reset = () => {
        setFile(null);
        setTitle('');
        setGenre('');
        setBpm('');
        setMusicalKey('');
        setMood('');
        setAiStatus('idle');
        setAiResult(null);
        setPublishStatus('idle');
        setPublishProgress(0);
    };

    // ─── Animations ─────────────────────────────────────────────────

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
    const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

    const isAnalyzing = aiStatus === 'analyzing';
    const canPublish = file && title && publishStatus !== 'uploading';

    // ─── Published Success View ─────────────────────────────────────

    if (publishStatus === 'done') {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 lg:p-12 max-w-[800px] mx-auto"
            >
                <div className="card-premium p-16 text-center space-y-8 flex flex-col items-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', bounce: 0.4, delay: 0.2 }}
                        className="size-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto"
                    >
                        <CheckCircle2 className="size-10" />
                    </motion.div>

                    <div>
                        <h2 className="text-2xl font-black text-white mb-2">Release Submitted</h2>
                        <p className="text-slate-400 text-sm max-w-md mx-auto">
                            <strong className="text-white">{title}</strong> has been submitted for review. 
                            Our backend will run full AI analysis in the background.
                        </p>
                    </div>

                    {aiResult?.hit_score != null && (
                        <div className="py-4">
                            <RadialGauge score={aiResult.hit_score} />
                        </div>
                    )}

                    <button
                        onClick={reset}
                        className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-black uppercase tracking-widest text-xs cursor-pointer"
                    >
                        Upload Another Release
                    </button>
                </div>
            </motion.div>
        );
    }

    // ─── Main Upload Form ───────────────────────────────────────────

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="p-8 lg:p-12 max-w-[1200px] mx-auto space-y-10">
            {/* Header */}
            <motion.header variants={itemAnim} className="space-y-1">
                <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Smart Release</p>
                <h1 className="text-4xl font-black tracking-tight text-white mb-2">Upload Release</h1>
                <p className="text-slate-400 text-sm max-w-xl">
                    Drop your audio and we'll smart-fill the metadata. Your AI partner detects genre, BPM, key, mood, and hit potential automatically.
                </p>
            </motion.header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* ─── Left: Dropzone (2 cols) ─────────────────────────── */}
                <motion.div variants={itemAnim} className="lg:col-span-2">
                    <div
                        className={cn(
                            'card-premium p-8 flex flex-col items-center justify-center min-h-[360px] border-2 border-dashed cursor-pointer',
                            isDragging ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/20',
                            file ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                        )}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        <AnimatePresence mode="wait">
                            {file ? (
                                <motion.div
                                    key="has-file"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="text-center space-y-4"
                                >
                                    <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                                        <FileAudio className="size-8" />
                                    </div>
                                    <h3 className="text-base font-bold text-white truncate max-w-[220px] mx-auto">{file.name}</h3>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest bg-white/5 py-1 px-3 rounded-full inline-block">
                                        {formatSize(file.size)} · {file.type.split('/')[1]?.toUpperCase() || 'Audio'}
                                    </p>

                                    {/* AI Status indicator */}
                                    <div className="pt-2">
                                        {isAnalyzing && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex items-center justify-center gap-2 text-primary/70"
                                            >
                                                <Loader2 className="size-3.5 animate-spin" />
                                                <span className="text-[11px] font-bold">Smart-filling metadata...</span>
                                            </motion.div>
                                        )}
                                        {aiStatus === 'done' && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex items-center justify-center gap-2 text-emerald-400"
                                            >
                                                <CheckCircle2 className="size-3.5" />
                                                <span className="text-[11px] font-bold">Metadata ready</span>
                                            </motion.div>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); setFile(null); setAiStatus('idle'); setAiResult(null); }}
                                        className="text-xs font-bold text-slate-500 hover:text-white"
                                    >
                                        Change file
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="no-file"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center group"
                                >
                                    <div className="size-16 rounded-2xl bg-white/5 text-slate-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-primary/20 group-hover:text-primary transition-all duration-300">
                                        <UploadCloud className="size-8" />
                                    </div>
                                    <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors mb-1">
                                        Drop your audio
                                    </h3>
                                    <p className="text-xs text-slate-500 max-w-[200px] mx-auto">
                                        MP3, WAV, FLAC, OGG — we'll handle the rest
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* ─── Right: Metadata Form (3 cols) ───────────────────── */}
                <motion.div variants={itemAnim} className="lg:col-span-3 card-premium p-8 space-y-5">
                    {/* Title + Hit Badge */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Track Title
                            </label>
                            {aiResult?.hit_score != null && (
                                <HitBadge score={aiResult.hit_score} />
                            )}
                        </div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="E.g., Midnight City (Demo)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 font-bold"
                        />
                    </div>

                    {/* Genre + BPM row */}
                    <div className="grid grid-cols-2 gap-4">
                        {isAnalyzing && !genre ? (
                            <ShimmerField label="Genre" />
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Genre
                                    {aiStatus === 'done' && genre && (
                                        <span className="ml-2 text-primary/60 normal-case tracking-normal font-medium">· AI suggested</span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    value={genre}
                                    onChange={(e) => setGenre(e.target.value)}
                                    placeholder="E.g., Pop, Electronic"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 font-bold text-sm"
                                />
                            </div>
                        )}

                        {isAnalyzing && !bpm ? (
                            <ShimmerField label="BPM" />
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    BPM
                                    {aiStatus === 'done' && bpm && (
                                        <span className="ml-2 text-primary/60 normal-case tracking-normal font-medium">· AI detected</span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    value={bpm}
                                    onChange={(e) => setBpm(e.target.value)}
                                    placeholder="E.g., 120"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 font-bold text-sm"
                                />
                            </div>
                        )}
                    </div>

                    {/* Key + Mood row */}
                    <div className="grid grid-cols-2 gap-4">
                        {isAnalyzing && !musicalKey ? (
                            <ShimmerField label="Key" />
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Key
                                    {aiStatus === 'done' && musicalKey && (
                                        <span className="ml-2 text-primary/60 normal-case tracking-normal font-medium">· AI detected</span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    value={musicalKey}
                                    onChange={(e) => setMusicalKey(e.target.value)}
                                    placeholder="E.g., C major"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 font-bold text-sm"
                                />
                            </div>
                        )}

                        {isAnalyzing && !mood ? (
                            <ShimmerField label="Mood" />
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Mood
                                    {aiStatus === 'done' && mood && (
                                        <span className="ml-2 text-primary/60 normal-case tracking-normal font-medium">· AI suggested</span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    value={mood}
                                    onChange={(e) => setMood(e.target.value)}
                                    placeholder="E.g., Energetic, Chill"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 font-bold text-sm"
                                />
                            </div>
                        )}
                    </div>

                    {/* AI Tags Summary (shown after analysis) */}
                    {aiStatus === 'done' && aiResult && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-4 bg-[#050505] border border-white/5 rounded-xl space-y-3 overflow-hidden"
                        >
                            <div className="flex items-center gap-2">
                                <Sparkles className="size-3.5 text-primary" />
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">AI Insights</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    ...aiResult.genre.map(t => ({ ...t, cat: 'genre' })),
                                    ...aiResult.style.map(t => ({ ...t, cat: 'style' })),
                                    ...aiResult.mood.map(t => ({ ...t, cat: 'mood' })),
                                    ...aiResult.instruments.map(t => ({ ...t, cat: 'instrument' })),
                                    ...aiResult.vocals.map(t => ({ ...t, cat: 'vocal' })),
                                ]
                                    .filter(t => t.confidence > 10)
                                    .slice(0, 12)
                                    .map((tag, i) => (
                                        <motion.span
                                            key={tag.name + i}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[11px] font-bold text-slate-300"
                                        >
                                            {tag.name}
                                            <span className="ml-1 text-slate-600">{tag.confidence}%</span>
                                        </motion.span>
                                    ))
                                }
                            </div>
                        </motion.div>
                    )}

                    {/* AI Error (subtle) */}
                    {aiStatus === 'error' && aiError && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                            <XCircle className="size-3.5 text-slate-600" />
                            <span>AI couldn't analyze this file — you can fill metadata manually.</span>
                        </div>
                    )}

                    {/* Publish Error */}
                    {publishError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <XCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-200 font-medium">{publishError}</p>
                        </div>
                    )}

                    {/* Publish Button */}
                    <button
                        onClick={handlePublish}
                        disabled={!canPublish}
                        className="w-full py-5 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:grayscale cursor-pointer shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-transform relative overflow-hidden"
                    >
                        {publishStatus === 'uploading' && (
                            <motion.div
                                className="absolute inset-0 bg-white/10"
                                initial={{ width: 0 }}
                                animate={{ width: `${publishProgress}%` }}
                                transition={{ duration: 0.4 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-3">
                            {publishStatus === 'uploading' ? (
                                <>
                                    <Loader2 className="size-5 animate-spin" />
                                    Publishing... {publishProgress}%
                                </>
                            ) : (
                                <>
                                    <ChevronRight className="size-5" />
                                    Publish Release
                                </>
                            )}
                        </span>
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}
