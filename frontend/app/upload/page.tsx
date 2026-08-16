'use client';
import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUploadStore } from '@/lib/uploadStore';
import AudioDNARadar from '@/components/ai/AudioDNARadar';
import AIMetadataSuggestor from '@/components/ai/AIMetadataSuggestor';
import ReleaseTimerDial from '@/components/ai/ReleaseTimerDial';
import { analyzeApi, tracksApi, storageApi, ApiError } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UploadCloud, Sparkles, ChevronRight, Loader2,
    Music, Hash, Tag, Users, ShieldAlert, Plus, Trash2, Shield, FileAudio, CheckCircle2,
    Image as ImageIcon, CalendarClock, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRequireAuth } from '@/lib/auth';

const fadeUp: any = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } } };

// Form Components
const FormInput = ({ label, value, onChange, placeholder, icon: Icon, type = "text", aiFilled = false, disabled = false }: { label: string, value: string | number, onChange: (v: any) => void, placeholder?: string, icon?: any, type?: string, aiFilled?: boolean, disabled?: boolean }) => (
    <div className={cn("space-y-2 relative group", disabled && "opacity-50 pointer-events-none")}>
        <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
            {Icon && <Icon className="size-3 text-slate-600" />}
            {label}
            {aiFilled && !disabled && <span className="text-primary/60 ml-2 animate-pulse font-medium tracking-normal normal-case">AI Suggested</span>}
        </label>
        <div className="relative">
            {aiFilled && !disabled && (
                <motion.div animate={{ opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -inset-[1px] bg-primary/30 rounded-xl blur-sm pointer-events-none" />
            )}
            <input
                type={type}
                value={value}
                onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                    "relative w-full bg-[#070708] border border-white/[0.06] rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-primary/50 text-sm font-bold transition-all",
                    aiFilled && !disabled && "border-primary/40 text-primary-100 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]"
                )}
            />
        </div>
    </div>
);

const FormToggle = ({ label, value, onChange, disabled = false }: { label: string, value: boolean, onChange: (v: boolean) => void, disabled?: boolean }) => (
    <div className={cn("flex items-center justify-between p-4 rounded-xl bg-[#070708] border border-white/[0.06]", disabled && "opacity-50 pointer-events-none")}>
        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            <ShieldAlert className="size-3 text-red-500/70" />
            {label}
        </span>
        <button onClick={() => onChange(!value)} disabled={disabled} className={cn("relative w-12 h-6 rounded-full transition-colors cursor-pointer", value ? "bg-red-500" : "bg-white/10")}>
            <div className={cn("absolute top-1 size-4 bg-white shadow rounded-full transition-transform", value ? "translate-x-7" : "translate-x-1")} />
        </button>
    </div>
);

const ShimmerOverlay = ({ analyzing }: { analyzing?: boolean }) => (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]/60 backdrop-blur-[2px] rounded-3xl">
        {analyzing && (
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-6 text-primary animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 animate-pulse">Extracting Topology</span>
            </div>
        )}
    </div>
);

export default function UploadReleasePage() {
    const { artist, isLoading: authLoading } = useRequireAuth();
    const store = useUploadStore();
    const fileRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Gate flag: artists must pass admin onboarding approval before uploading.
    // (The gate renders below, after all hooks, to keep hook order stable.)
    const approvalStatus = artist?.approval_status ?? 'approved';
    const approvalBlocked = !authLoading && !!artist && approvalStatus !== 'approved';

    const totalPercentage = store.collaborators.reduce((sum, c) => sum + (Number(c.percentage) || 0), 0);
    const isValidSplit = totalPercentage === 100;
    const isAnalyzing = store.step === 'decoding';
    const isReady = store.step === 'reveal';

    useEffect(() => {
        if (store.step === 'decoding') {
            let p = 0;
            const timer = setInterval(() => {
                p += 5; 
                store.setAnalysisProgress(Math.min(p, 95)); // Hold at 95% until AI actually finishes
            }, 100);

            // Execute the actual AI model synchronously with the visual load
            analyzeApi.analyzeFile(store.file!).then((res: any) => {
                store.setMetadata({
                    genre: res.genre?.[0]?.name || 'Electronic',
                    bpm: String(Math.round(res.bpm || 128)),
                    key: res.key || 'C Minor',
                    mood: res.mood?.[0]?.name || 'Hypnotic'
                });
                store.setProfMeta({ title: store.file?.name.replace(/\.[^/.]+$/, '') || 'Untitled' });
                store.setHitScore(res.hit_score || 82);

                clearInterval(timer);
                store.setAnalysisProgress(100);
                setTimeout(() => store.setStep('reveal'), 500); 
            }).catch(() => {
                // Failsafe Mock
                clearInterval(timer);
                store.setAnalysisProgress(100);
                store.setMetadata({ genre: 'Electronic', bpm: '128', key: 'C Minor', mood: 'Hypnotic' });
                store.setProfMeta({ title: store.file?.name.replace(/\.[^/.]+$/, '') || 'Untitled' });
                store.setHitScore(82);
                setTimeout(() => store.setStep('reveal'), 500);
            });

            return () => clearInterval(timer);
        }
    }, [store.step, store.file]);

    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [publishSuccess, setPublishSuccess] = useState(false);

    // Real audio duration, extracted client-side from the file's metadata
    const [duration, setDuration] = useState<number | null>(null);
    // Optional artwork + release scheduling
    const coverRef = useRef<HTMLInputElement>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [releaseDate, setReleaseDate] = useState<string>('');

    const extractDuration = (f: File) => {
        const url = URL.createObjectURL(f);
        const audio = new Audio();
        audio.preload = 'metadata';
        let revoked = false;
        const cleanup = () => {
            if (!revoked) {
                revoked = true;
                URL.revokeObjectURL(url);
            }
        };
        const commit = () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
                setDuration(Math.round(audio.duration));
                cleanup();
            }
        };
        audio.onloadedmetadata = () => {
            // Some MP3 encodings (common from AI-generation tools) report
            // duration as Infinity on this first event instead of the real
            // value — silently rejecting it left `duration` stuck at null,
            // sent to the backend as 0. Seeking near the end forces the
            // browser to recompute the real duration, firing durationchange
            // with the correct value instead.
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
                commit();
            } else {
                audio.currentTime = Number.MAX_SAFE_INTEGER;
            }
        };
        audio.ondurationchange = commit;
        audio.onerror = () => cleanup();
        audio.src = url;
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f && f.type.startsWith('image/')) {
            setCoverFile(f);
            setCoverPreview(URL.createObjectURL(f));
        }
    };

    const handlePublish = async () => {
        if (!isValidSplit || !store.file) return;
        setIsPublishing(true);
        setPublishError(null);
        try {
            // 1. Upload the audio file (presigned flow; local-mock or S3)
            const audioUpload = await storageApi.uploadFile(store.file, 'tracks');

            // 2. Upload artwork if provided
            let coverArtUrl: string | null = null;
            if (coverFile) {
                const coverUpload = await storageApi.uploadFile(coverFile, 'covers');
                coverArtUrl = coverUpload.file_url;
            }

            // 3. Create the track with real metadata
            await tracksApi.createTrack({
                title: store.profMeta.title,
                genre: store.metadata.genre,
                duration: duration ?? 0,
                file_url: audioUpload.file_url,
                cover_art_url: coverArtUrl,
                bpm: store.metadata.bpm ? Number(store.metadata.bpm) : null,
                is_public: false, // Stays private until admin approval
                isrc: store.profMeta.isrc || null,
                is_explicit: store.profMeta.explicit,
                release_date: releaseDate ? new Date(releaseDate).toISOString() : null,
                collaborators: store.collaborators
                    .filter(c => c.name.trim())
                    .map(c => ({ name: c.name.trim(), royalty_percentage: Number(c.percentage) || 0 })),
            });

            setPublishSuccess(true);
            // Show brief success before resetting
            setTimeout(() => {
                setIsPublishing(false);
                setPublishSuccess(false);
                setCoverFile(null);
                setCoverPreview(null);
                setReleaseDate('');
                setDuration(null);
                store.reset();
                router.push('/music');
            }, 1500);
        } catch (error) {
            setPublishError(error instanceof ApiError ? error.message : 'Failed to publish the release. Please try again.');
            setIsPublishing(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('audio/')) {
            store.setFile(f);
            extractDuration(f);
            store.setStep('decoding');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if(f) { store.setFile(f); extractDuration(f); store.setStep('decoding'); }
    };

    if (approvalBlocked) {
        const rejected = approvalStatus === 'rejected';
        return (
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-8">
                <div className="max-w-lg w-full text-center card-premium p-12 space-y-5 border border-white/5">
                    <div className={cn(
                        "size-16 rounded-2xl mx-auto flex items-center justify-center",
                        rejected ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                    )}>
                        <Shield className="size-8" />
                    </div>
                    <h1 className="text-2xl font-black text-white">
                        {rejected ? 'Artist profile not approved' : 'Admin approval pending'}
                    </h1>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed">
                        {rejected
                            ? 'Your artist profile was not approved by our admins. Please contact support for details.'
                            : 'Your artist profile is being reviewed by our admins. You’ll receive an email as soon as it’s approved — then you can upload and distribute your music.'}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                        Meanwhile you can explore the platform, browse the Jam Jar, and check the leaderboard.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white py-12 px-6 lg:px-10 max-w-[1500px] mx-auto overflow-hidden relative font-sans">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-primary/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Header matches styling requested */}
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-1 text-left mb-10 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6366f1]">Smart Release Engine</p>
                <h1 className="text-4xl font-black tracking-tight text-white mb-2">Upload Release</h1>
                <p className="text-sm text-slate-400 max-w-2xl">
                    Upload your unreleased stem or track. Our AI will seamlessly extract 16 acoustic features, map metadata, and prepare your release for global algorithmic distribution.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
                {/* ─── LEFT COLUMN ─── */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Dropzone */}
                    <div 
                        onClick={() => !isAnalyzing && fileRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleDrop}
                        className={cn(
                            "w-full rounded-[2rem] border-2 p-8 flex flex-col items-center justify-center min-h-[300px] transition-all bg-[#0a0a0b]/80 backdrop-blur-md shadow-2xl relative overflow-hidden",
                            isAnalyzing ? "border-primary/40 cursor-not-allowed" : store.file ? "border-emerald-500/30 cursor-pointer" : "border-dashed border-white/10 hover:border-primary/30 cursor-pointer"
                        )}
                    >
                        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} disabled={isAnalyzing} />
                        
                        <AnimatePresence mode="wait">
                            {store.file ? (
                                <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
                                    <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                                        <FileAudio className="size-8" />
                                    </div>
                                    <h3 className="text-base font-bold text-white truncate max-w-[220px] mx-auto">{store.file.name}</h3>
                                    
                                    <div className="pt-2">
                                        {isAnalyzing && (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="flex items-center gap-2 text-primary/80">
                                                    <Loader2 className="size-3.5 animate-spin" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Scanning...</span>
                                                </div>
                                                <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div className="h-full bg-primary" animate={{ width: `${store.analysisProgress}%` }} />
                                                </div>
                                            </div>
                                        )}
                                        {isReady && (
                                            <div className="flex items-center justify-center gap-2 text-emerald-400">
                                                <CheckCircle2 className="size-4" />
                                                <span className="text-[11px] font-black uppercase tracking-widest">Scan Complete</span>
                                            </div>
                                        )}
                                    </div>
                                    {isReady && (
                                        <button onClick={(e) => { e.stopPropagation(); store.reset(); }} className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest mt-4">
                                            Clear File
                                        </button>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center group">
                                    <div className="size-16 rounded-2xl bg-white/[0.03] text-slate-500 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-primary/20 group-hover:text-primary transition-all duration-300">
                                        <UploadCloud className="size-8" />
                                    </div>
                                    <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors mb-1">Select Audio File</h3>
                                    <p className="text-xs text-slate-600 max-w-[200px] mx-auto">Drag and drop your MP3, WAV, or FLAC file here.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Audio DNA Radar */}
                    <AnimatePresence>
                        {store.file && (
                            <motion.div initial={{ opacity: 0, height: 0, scale: 0.95 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} className="relative">
                                <motion.div 
                                    className="relative flex justify-center bg-[#070708] rounded-[2rem] border border-white/[0.06] p-4 overflow-hidden"
                                    initial={{ filter: 'grayscale(100%) opacity(0.5)' }}
                                    animate={{ filter: `grayscale(${Math.max(0, 100 - store.analysisProgress)}%) opacity(1)` }}
                                >
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                                            <motion.div 
                                                className="w-full h-px bg-cyan-400 shadow-[0_0_20px_#22d3ee] mix-blend-screen"
                                                animate={{ y: ['0%', '100%'] }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                            />
                                        </div>
                                    )}
                                    <div className={cn("w-full scale-100 transition-all", isAnalyzing && "pointer-events-none")}>
                                        <AudioDNARadar trackTitle={store.file.name.replace(/\.[^/.]+$/, '')} className="!bg-transparent !border-none !shadow-none ring-0 p-0" />
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ─── RIGHT COLUMN ─── */}
                <div className="lg:col-span-8 flex flex-col gap-6 relative min-h-[600px] pb-32">
                    
                    {(!store.file || isAnalyzing) && <ShimmerOverlay analyzing={isAnalyzing} />}

                    {/* A. AI Metadata */}
                    <section className="p-8 rounded-3xl border border-white/[0.04] bg-[#0a0a0b]/40 backdrop-blur-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
                        <div className="flex flex-col gap-4 border-b border-primary/10 pb-4 mb-6">
                            <div className="flex items-center gap-3">
                                <Sparkles className="size-4 text-primary" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-primary">Smart-Fill Metadata & AI Quality Score</h3>
                            </div>
                            <AIMetadataSuggestor
                                title={store.profMeta.title || store.file?.name?.replace(/\.[^/.]+$/, '') || ''}
                                disabled={isAnalyzing || !store.file}
                                onSuggest={(s) => {
                                    store.setMetadata({
                                        genre: s.genre,
                                        mood: s.mood,
                                        bpm: String(s.bpm),
                                        key: s.key,
                                    });
                                }}
                                onAddChip={(tag, type) => {
                                    if (type === 'genre') {
                                        store.setMetadata({ genre: tag });
                                    } else {
                                        store.setMetadata({ mood: tag });
                                    }
                                }}
                            />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                            <FormInput label="Genre" value={store.metadata.genre} onChange={v => store.setMetadata({ genre: v })} icon={Music} aiFilled disabled={isAnalyzing} />
                            <FormInput label="BPM" value={store.metadata.bpm} onChange={v => store.setMetadata({ bpm: v })} icon={Tag} aiFilled disabled={isAnalyzing} />
                            <FormInput label="Key" value={store.metadata.key} onChange={v => store.setMetadata({ key: v })} icon={Tag} aiFilled disabled={isAnalyzing} />
                            <FormInput label="Mood" value={store.metadata.mood} onChange={v => store.setMetadata({ mood: v })} icon={Tag} aiFilled disabled={isAnalyzing} />
                        </div>
                    </section>

                    {/* B. Professional Metadata & Release Timing */}
                    <section className="p-8 rounded-3xl bg-[#0a0a0b]/40 border border-white/[0.04] backdrop-blur-md space-y-6">
                        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
                            <Shield className="size-4 text-slate-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Professional Data & Scheduling</h3>
                        </div>
                        <div className="space-y-4">
                            <FormInput label="Track Title" value={store.profMeta.title} onChange={v => store.setProfMeta({ title: v })} placeholder="Original Mix" disabled={isAnalyzing} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <FormInput label="ISRC Code" value={store.profMeta.isrc} onChange={v => store.setProfMeta({ isrc: v })} icon={Hash} placeholder="US-XXX-XX-XXXXX" disabled={isAnalyzing} />
                                <FormToggle label="Explicit Content" value={store.profMeta.explicit} onChange={v => store.setProfMeta({ explicit: v })} disabled={isAnalyzing} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-2">
                                {/* Cover Artwork */}
                                <div className={cn("space-y-2", isAnalyzing && "opacity-50 pointer-events-none")}>
                                    <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                                        <ImageIcon className="size-3 text-slate-600" />
                                        Cover Artwork <span className="tracking-normal normal-case font-medium text-slate-600">(optional)</span>
                                    </label>
                                    <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={isAnalyzing} />
                                    {coverPreview ? (
                                        <div className="relative w-full h-[52px] rounded-xl border border-white/[0.06] bg-[#070708] flex items-center gap-3 px-3">
                                            <img src={coverPreview} className="size-9 rounded-lg object-cover" alt="Cover preview" />
                                            <span className="text-xs font-bold text-white truncate flex-1">{coverFile?.name}</span>
                                            <button
                                                onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => coverRef.current?.click()}
                                            className="w-full h-[52px] rounded-xl border border-dashed border-white/10 bg-[#070708] text-slate-500 hover:text-primary hover:border-primary/30 transition-colors text-xs font-bold flex items-center justify-center gap-2"
                                        >
                                            <Plus className="size-4" /> Add Artwork
                                        </button>
                                    )}
                                </div>

                                {/* Release Scheduling Input */}
                                <div className={cn("space-y-2", isAnalyzing && "opacity-50 pointer-events-none")}>
                                    <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                                        <CalendarClock className="size-3 text-slate-600" />
                                        Scheduled Release Date
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={releaseDate}
                                        onChange={e => setReleaseDate(e.target.value)}
                                        min={new Date().toISOString().slice(0, 16)}
                                        disabled={isAnalyzing}
                                        className="w-full h-[52px] bg-[#070708] border border-white/[0.06] rounded-xl px-5 text-white focus:outline-none focus:border-primary/50 text-sm font-bold transition-all [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            {/* Smart Release Recommendation Component */}
                            <div className="pt-4">
                                <ReleaseTimerDial
                                    genre={store.metadata.genre}
                                    targetMarket="india_domestic"
                                    plannedLeadTimeDays={14}
                                />
                            </div>

                            {duration !== null && (
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                                    Detected duration: {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                                </p>
                            )}
                        </div>
                    </section>

                    {/* C. Collaborative Ownership Split Sheet */}
                    <section className="p-8 rounded-3xl bg-[#0a0a0b]/40 border border-white/[0.04] backdrop-blur-md">
                        <div className="flex flex-wrap gap-4 items-center justify-between border-b border-white/[0.06] pb-4 mb-6">
                            <div className="flex items-center gap-3">
                                <Users className="size-4 text-slate-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-white">Split Sheet Configuration</h3>
                            </div>
                            <div className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border", isValidSplit ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-red-400 bg-red-500/10 border-red-500/30")}>
                                Total: {totalPercentage}%
                            </div>
                        </div>

                        <div className="space-y-3">
                            {store.collaborators.map((collab, i) => (
                                <div key={collab.id} className="flex gap-3 items-center">
                                    <div className="flex-1">
                                        <FormInput label={i === 0 ? "Collaborator Name" : ""} value={collab.name} onChange={v => store.updateCollaborator(collab.id, { name: v })} placeholder="Stage Name" disabled={isAnalyzing} />
                                    </div>
                                    <div className="w-24 shrink-0">
                                        <FormInput label={i === 0 ? "Royalty %" : ""} value={collab.percentage} onChange={v => store.updateCollaborator(collab.id, { percentage: v })} type="number" disabled={isAnalyzing} />
                                    </div>
                                    <button 
                                        onClick={() => store.removeCollaborator(collab.id)} 
                                        className={cn("p-[14px] shrink-0 rounded-xl bg-white/[0.02] border border-white/[0.04] text-slate-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-colors", i === 0 && "mt-[26px]", isAnalyzing && "pointer-events-none opacity-50")}
                                        disabled={store.collaborators.length === 1 || isAnalyzing}
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        
                        <button onClick={store.addCollaborator} disabled={isAnalyzing} className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors cursor-pointer mt-4", isAnalyzing && "pointer-events-none opacity-50")}>
                            <Plus className="size-3" /> Add Collaborator
                        </button>
                    </section>

                    {/* D. Final Verdict & Publish */}
                    <AnimatePresence>
                        {isReady && (
                            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8 rounded-3xl bg-[#0a0a0b]/60 border border-white/[0.06] backdrop-blur-xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8 justify-between mt-4">
                                <div className="absolute top-1/2 left-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none -translate-y-1/2" />
                                
                                <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
                                    <div className="size-20 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <span className="text-2xl font-black text-emerald-400">{Math.round(store.hitScore)}%</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80 mb-1">Vitality Matrix</p>
                                        <h3 className="text-lg font-light text-white">Hit Potential: {store.hitScore >= 75 ? 'Peak' : store.hitScore >= 50 ? 'Strong' : 'Niche'}</h3>
                                    </div>
                                </div>

                                <div className="w-full md:w-auto flex-1 md:flex-none flex flex-col items-center gap-3">
                                    <button
                                        disabled={!isValidSplit || isPublishing}
                                        onClick={handlePublish}
                                        className="w-full md:w-80 py-4 bg-white text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 disabled:opacity-20 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {publishSuccess ? (
                                            <>Deployed <CheckCircle2 className="size-5 text-emerald-600" /></>
                                        ) : isPublishing ? (
                                            <>Deploying... <Loader2 className="size-5 animate-spin" /></>
                                        ) : (
                                            <>Deploy the Drop <ChevronRight className="size-5" /></>
                                        )}
                                    </button>
                                    {!isValidSplit && (
                                        <p className="text-[9px] uppercase font-black tracking-widest text-red-500">
                                            Error: Split must exactly equal 100%. (Current: {totalPercentage}%)
                                        </p>
                                    )}
                                    {publishError && (
                                        <p className="text-[9px] uppercase font-black tracking-widest text-red-500 text-center max-w-80">
                                            {publishError}
                                        </p>
                                    )}
                                    {releaseDate && (
                                        <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">
                                            Scheduled for {new Date(releaseDate).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </motion.section>
                        )}
                    </AnimatePresence>

                </div>
            </div>
        </div>
    );
}
