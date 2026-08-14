'use client';

import { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Youtube, Music2, Radio, AlertCircle, CheckCircle2, Loader2, Link2, Globe2, Tag, Info, ImageUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    distributionApi,
    integrationsApi,
    storageApi,
    TrackDistributionStatus,
    DistributionPlatform,
    ApiError,
} from '@/lib/api';

interface DistributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    trackId: number;
    trackTitle: string;
}

// Major markets offered for territory selection. Empty selection = worldwide.
const TERRITORIES: { code: string; label: string }[] = [
    { code: 'IN', label: 'India' },
    { code: 'US', label: 'United States' },
    { code: 'GB', label: 'United Kingdom' },
    { code: 'DE', label: 'Germany' },
    { code: 'BR', label: 'Brazil' },
    { code: 'JP', label: 'Japan' },
    { code: 'KR', label: 'South Korea' },
    { code: 'AU', label: 'Australia' },
];

// Known platform icons; anything unknown falls back to a generic icon
// tinted with the platform's brand color coming from the backend.
function platformIcon(platformId: string, color: string): ReactNode {
    switch (platformId) {
        case 'youtube':
            return <Youtube className="size-6" style={{ color }} />;
        case 'spotify':
            return <Music2 className="size-6" style={{ color }} />;
        default:
            return <Radio className="size-6" style={{ color }} />;
    }
}

export function DistributionModal({ isOpen, onClose, trackId, trackTitle }: DistributionModalProps) {
    const [platforms, setPlatforms] = useState<DistributionPlatform[]>([]);
    const [distributions, setDistributions] = useState<TrackDistributionStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [distributing, setDistributing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Empty selection = worldwide release
    const [territories, setTerritories] = useState<string[]>([]);
    // YouTube is the only adapter that actually publishes content, so it's the
    // only one that needs a details step before we fire the upload — Distribute
    // used to go out with 100% silent defaults (including 'unlisted' visibility).
    const [youtubeFormOpen, setYoutubeFormOpen] = useState(false);
    const [ytTitle, setYtTitle] = useState(trackTitle);
    const [ytDescription, setYtDescription] = useState('');
    const [ytVisibility, setYtVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
    const [ytTags, setYtTags] = useState('');
    const [ytMadeForKids, setYtMadeForKids] = useState(false);
    // Optional — overrides the track's own cover art (if any) for this
    // publish only. Neither set means the adapter falls back to a black frame.
    const [ytCoverFile, setYtCoverFile] = useState<File | null>(null);
    const [ytCoverPreview, setYtCoverPreview] = useState<string | null>(null);

    const toggleTerritory = (code: string) => {
        setTerritories(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    const handleCoverSelect = (file: File | null) => {
        setYtCoverFile(file);
        setYtCoverPreview(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return file ? URL.createObjectURL(file) : null;
        });
    };

    // Revoke the object URL when it changes or the modal unmounts, so we
    // don't leak blob URLs across repeated opens.
    useEffect(() => {
        return () => {
            if (ytCoverPreview) URL.revokeObjectURL(ytCoverPreview);
        };
    }, [ytCoverPreview]);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, trackId]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [platformData, distData] = await Promise.all([
                distributionApi.getPlatforms(),
                distributionApi.getTrackDistributions(trackId),
            ]);
            setPlatforms(platformData);
            setDistributions(distData);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to fetch distribution status');
        } finally {
            setLoading(false);
        }
    };

    const distributeToPlatform = async (platformId: string, options?: Record<string, unknown>) => {
        setDistributing(platformId);
        setError(null);
        try {
            await distributionApi.distribute(trackId, platformId, territories, options);
            setDistributions(await distributionApi.getTrackDistributions(trackId));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Distribution failed');
        } finally {
            setDistributing(null);
        }
    };

    const handlePublishToYoutube = async () => {
        setDistributing('youtube');
        setError(null);
        try {
            // Upload the custom cover image first, if one was picked — a
            // failure here should stop before we ever call distribute.
            let coverImageUrl: string | undefined;
            if (ytCoverFile) {
                const upload = await storageApi.uploadFile(ytCoverFile, 'covers');
                coverImageUrl = upload.file_url;
            }

            const tags = ytTags.split(',').map(t => t.trim()).filter(Boolean);
            await distributionApi.distribute(trackId, 'youtube', territories, {
                title: ytTitle.trim() || trackTitle,
                // Empty description/tags fall through to the backend's own
                // genre-aware defaults rather than sending a worse duplicate.
                ...(ytDescription.trim() ? { description: ytDescription.trim() } : {}),
                ...(tags.length > 0 ? { tags } : {}),
                ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
                privacy: ytVisibility,
                made_for_kids: ytMadeForKids,
            });
            setDistributions(await distributionApi.getTrackDistributions(trackId));
            setYoutubeFormOpen(false);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Publishing to YouTube failed');
        } finally {
            setDistributing(null);
        }
    };

    const connectPlatform = async (platform: DistributionPlatform) => {
        if (!platform.login_endpoint) return;
        try {
            await integrationsApi.connect(platform.login_endpoint);
        } catch {
            setError(`Could not start the ${platform.name} connection flow.`);
        }
    };

    const getPlatformStatus = (platformId: string) => {
        return distributions.find(d => d.platform === platformId);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-white">Distribute Release</h2>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
                                {trackTitle}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white">
                            <X className="size-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                                <AlertCircle className="size-5 text-red-500 shrink-0" />
                                <p className="text-xs text-red-200">{error}</p>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <Loader2 className="size-8 text-primary animate-spin mb-4" />
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Loading Status...</p>
                            </div>
                        ) : (
                            <>
                            {/* Territory selection */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Globe2 className="size-4 text-slate-500" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Release Territories</span>
                                    <span className="text-[9px] font-bold text-slate-600 normal-case">
                                        {territories.length === 0 ? '(Worldwide)' : `(${territories.length} selected)`}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setTerritories([])}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors",
                                            territories.length === 0
                                                ? "bg-primary text-white border-transparent"
                                                : "bg-white/5 text-slate-400 border-white/5 hover:text-white"
                                        )}
                                    >
                                        Worldwide
                                    </button>
                                    {TERRITORIES.map(t => (
                                        <button
                                            key={t.code}
                                            onClick={() => toggleTerritory(t.code)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors",
                                                territories.includes(t.code)
                                                    ? "bg-primary text-white border-transparent"
                                                    : "bg-white/5 text-slate-400 border-white/5 hover:text-white"
                                            )}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {platforms.map((platform) => {
                                    const status = getPlatformStatus(platform.id);
                                    const alreadyHandled = status?.status === 'live' || status?.status === 'pending' || status?.status === 'processing';
                                    // YouTube is the only adapter that actually publishes content — it's
                                    // the only one that needs a details step before firing the upload.
                                    const needsDetailsStep = platform.id === 'youtube' && !alreadyHandled;

                                    return (
                                        <div key={platform.id}>
                                            <PlatformCard
                                                platform={platform}
                                                icon={platformIcon(platform.id, platform.color)}
                                                status={status}
                                                onDistribute={() =>
                                                    needsDetailsStep
                                                        ? setYoutubeFormOpen(true)
                                                        : distributeToPlatform(platform.id)
                                                }
                                                onConnect={() => connectPlatform(platform)}
                                                isDistributing={distributing === platform.id}
                                            />
                                            {needsDetailsStep && youtubeFormOpen && (
                                                <YoutubePublishForm
                                                    title={ytTitle}
                                                    onTitleChange={setYtTitle}
                                                    description={ytDescription}
                                                    onDescriptionChange={setYtDescription}
                                                    visibility={ytVisibility}
                                                    onVisibilityChange={setYtVisibility}
                                                    tags={ytTags}
                                                    onTagsChange={setYtTags}
                                                    madeForKids={ytMadeForKids}
                                                    onMadeForKidsChange={setYtMadeForKids}
                                                    coverPreview={ytCoverPreview}
                                                    onCoverSelect={handleCoverSelect}
                                                    submitting={distributing === 'youtube'}
                                                    onCancel={() => setYoutubeFormOpen(false)}
                                                    onSubmit={handlePublishToYoutube}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

interface PlatformCardProps {
    platform: DistributionPlatform;
    icon: ReactNode;
    status?: TrackDistributionStatus;
    onDistribute: () => void;
    onConnect: () => void;
    isDistributing: boolean;
}

function PlatformCard({ platform, icon, status, onDistribute, onConnect, isDistributing }: PlatformCardProps) {
    const isLive = status?.status === 'live';
    const isPending = status?.status === 'pending' || status?.status === 'processing';
    const isFailed = status?.status === 'failed';

    return (
        <div className="p-4 rounded-xl border border-white/5 bg-[#111] flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="size-12 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                    {icon}
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">{platform.name}</h3>
                    {!platform.supports_distribution ? (
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            Analytics Only
                        </p>
                    ) : !platform.connected ? (
                        <p className="text-[10px] font-black text-amber-400/80 uppercase tracking-widest mt-1">
                            Not Connected
                        </p>
                    ) : status ? (
                        <div className="flex items-center gap-1.5 mt-1">
                            {isLive && <CheckCircle2 className="size-3 text-emerald-400" />}
                            {isPending && <Loader2 className="size-3 text-primary animate-spin" />}
                            {isFailed && <AlertCircle className="size-3 text-red-400" />}
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                isLive ? "text-emerald-400" : isPending ? "text-primary" : "text-red-400"
                            )}>
                                {status.status}
                            </span>
                        </div>
                    ) : (
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            Not Distributed
                        </p>
                    )}
                </div>
            </div>

            <div>
                {!platform.supports_distribution ? (
                    <span className="px-4 py-2 rounded-lg bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest cursor-not-allowed">
                        Unavailable
                    </span>
                ) : !platform.connected ? (
                    <button
                        onClick={onConnect}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors flex items-center gap-2"
                    >
                        <Link2 className="size-3" />
                        Connect
                    </button>
                ) : isLive ? (
                    status?.platform_url ? (
                        <a
                            href={status.platform_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 rounded-lg bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                        >
                            View Live
                        </a>
                    ) : (
                        <span className="text-[10px] text-slate-500 font-bold">LIVE</span>
                    )
                ) : isPending || isDistributing ? (
                    <button disabled className="px-4 py-2 rounded-lg bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Loader2 className="size-3 animate-spin" />
                        Processing
                    </button>
                ) : (
                    <button
                        onClick={onDistribute}
                        className="px-4 py-2 rounded-lg bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                    >
                        {isFailed ? 'Retry' : 'Distribute'}
                    </button>
                )}
            </div>
        </div>
    );
}

const VISIBILITY_OPTIONS: { value: 'public' | 'unlisted' | 'private'; label: string; hint: string }[] = [
    { value: 'public', label: 'Public', hint: 'Anyone can find and watch it' },
    { value: 'unlisted', label: 'Unlisted', hint: 'Only people with the link' },
    { value: 'private', label: 'Private', hint: 'Only you can view it' },
];

interface YoutubePublishFormProps {
    title: string;
    onTitleChange: (v: string) => void;
    description: string;
    onDescriptionChange: (v: string) => void;
    visibility: 'public' | 'unlisted' | 'private';
    onVisibilityChange: (v: 'public' | 'unlisted' | 'private') => void;
    tags: string;
    onTagsChange: (v: string) => void;
    madeForKids: boolean;
    onMadeForKidsChange: (v: boolean) => void;
    coverPreview: string | null;
    onCoverSelect: (file: File | null) => void;
    submitting: boolean;
    onCancel: () => void;
    onSubmit: () => void;
}

function YoutubePublishForm({
    title, onTitleChange,
    description, onDescriptionChange,
    visibility, onVisibilityChange,
    tags, onTagsChange,
    madeForKids, onMadeForKidsChange,
    coverPreview, onCoverSelect,
    submitting, onCancel, onSubmit,
}: YoutubePublishFormProps) {
    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-4 rounded-xl border border-white/10 bg-[#0d0d0d] space-y-4 overflow-hidden"
        >
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Youtube className="size-3.5 text-[#FF0000]" />
                Publish to YouTube
            </div>

            {/* Title */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Video Title</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    maxLength={100}
                    placeholder="Video title"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50"
                />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Description</label>
                <textarea
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    rows={2}
                    maxLength={5000}
                    placeholder="Distributed via NextDrop — leave blank to use a generated description"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-primary/50"
                />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <Tag className="size-3" /> Tags
                </label>
                <input
                    type="text"
                    value={tags}
                    onChange={(e) => onTagsChange(e.target.value)}
                    placeholder="comma, separated, tags — leave blank to use your genre"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50"
                />
            </div>

            {/* Cover image — overrides the track's own cover art for this video only */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <ImageUp className="size-3" /> Video Image <span className="normal-case font-medium text-slate-600">(optional)</span>
                </label>
                <div className="flex items-center gap-3">
                    <div className="size-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                        {coverPreview ? (
                            <img src={coverPreview} alt="Cover preview" className="size-full object-cover" />
                        ) : (
                            <Youtube className="size-5 text-slate-700" />
                        )}
                    </div>
                    <div className="flex-1 space-y-1">
                        <label className="inline-block px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                            {coverPreview ? 'Change Image' : 'Upload Image'}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => onCoverSelect(e.target.files?.[0] ?? null)}
                            />
                        </label>
                        {coverPreview && (
                            <button
                                type="button"
                                onClick={() => onCoverSelect(null)}
                                className="block text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
                            >
                                Remove
                            </button>
                        )}
                        <p className="text-[9px] text-slate-600">
                            Otherwise uses this track&apos;s cover art, or a black frame if it has none.
                        </p>
                    </div>
                </div>
            </div>

            {/* Visibility */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Visibility</label>
                <div className="flex flex-wrap gap-2">
                    {VISIBILITY_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onVisibilityChange(opt.value)}
                            title={opt.hint}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors",
                                visibility === opt.value
                                    ? "bg-primary text-white border-transparent"
                                    : "bg-white/5 text-slate-400 border-white/5 hover:text-white"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Made for kids */}
            <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                    type="checkbox"
                    checked={madeForKids}
                    onChange={(e) => onMadeForKidsChange(e.target.checked)}
                    className="mt-0.5 size-3.5 accent-primary cursor-pointer"
                />
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                    This video is made for kids
                    <span className="flex items-center gap-1 text-[9px] text-slate-600 mt-0.5">
                        <Info className="size-3 shrink-0" />
                        Required by YouTube on every upload (COPPA). Leave unchecked for a standard music release.
                    </span>
                </span>
            </label>

            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={onCancel}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    disabled={submitting || !title.trim()}
                    className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                    {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Youtube className="size-3.5" />}
                    {submitting ? 'Publishing...' : 'Publish to YouTube'}
                </button>
            </div>
        </motion.div>
    );
}
