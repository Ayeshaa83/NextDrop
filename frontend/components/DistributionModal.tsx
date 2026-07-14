'use client';

import { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Youtube, Music2, Radio, AlertCircle, CheckCircle2, Loader2, Link2, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    distributionApi,
    integrationsApi,
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

    const toggleTerritory = (code: string) => {
        setTerritories(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

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

    const distributeToPlatform = async (platformId: string) => {
        setDistributing(platformId);
        setError(null);
        try {
            await distributionApi.distribute(trackId, platformId, territories);
            setDistributions(await distributionApi.getTrackDistributions(trackId));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Distribution failed');
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
                                {platforms.map((platform) => (
                                    <PlatformCard
                                        key={platform.id}
                                        platform={platform}
                                        icon={platformIcon(platform.id, platform.color)}
                                        status={getPlatformStatus(platform.id)}
                                        onDistribute={() => distributeToPlatform(platform.id)}
                                        onConnect={() => connectPlatform(platform)}
                                        isDistributing={distributing === platform.id}
                                    />
                                ))}
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
