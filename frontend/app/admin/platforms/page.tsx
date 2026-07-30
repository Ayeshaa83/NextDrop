'use client';

import { useState } from 'react';
import { usePlatformConfigs } from '@/lib/hooks';
import { adminApi, PlatformConfigInput } from '@/lib/api';
import { Plug, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlatformManagementPage() {
    const { data: platformConfigs, refetch } = usePlatformConfigs();
    const [platformBusyId, setPlatformBusyId] = useState<number | null>(null);
    const [showAddPlatform, setShowAddPlatform] = useState(false);
    const [newPlatform, setNewPlatform] = useState<PlatformConfigInput>({
        platform_id: '', display_name: '', description: '', color: '#888888', category: 'music',
    });

    const handleTogglePlatform = async (cfg: { id: number } & PlatformConfigInput) => {
        setPlatformBusyId(cfg.id);
        try {
            await adminApi.updatePlatformConfig(cfg.id, { ...cfg, enabled: !cfg.enabled });
            refetch();
        } catch (err) {
            console.error('Failed to toggle platform:', err);
        } finally {
            setPlatformBusyId(null);
        }
    };

    const handleDeletePlatform = async (configId: number) => {
        setPlatformBusyId(configId);
        try {
            await adminApi.deletePlatformConfig(configId);
            refetch();
        } catch (err) {
            console.error('Failed to delete platform:', err);
        } finally {
            setPlatformBusyId(null);
        }
    };

    const handleAddPlatform = async () => {
        if (!newPlatform.platform_id.trim() || !newPlatform.display_name.trim()) return;
        try {
            await adminApi.createPlatformConfig(newPlatform);
            setNewPlatform({ platform_id: '', display_name: '', description: '', color: '#888888', category: 'music' });
            setShowAddPlatform(false);
            refetch();
        } catch (err) {
            console.error('Failed to add platform:', err);
        }
    };

    return (
        <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Plug className="size-6 text-primary" />
                    Platforms
                </h2>
                <button
                    onClick={() => setShowAddPlatform(!showAddPlatform)}
                    className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl font-semibold text-sm transition-all flex items-center gap-2"
                >
                    <Plus className="size-4" />
                    Add Platform
                </button>
            </div>
            <p className="text-slate-500 text-sm mb-6 -mt-3">
                Platforms with a live integration can be enabled or disabled platform-wide.
                Added platforms appear as &quot;Coming Soon&quot; until an integration adapter is built for them.
            </p>

            {showAddPlatform && (
                <div className="p-5 mb-6 bg-white/5 rounded-2xl border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        value={newPlatform.platform_id}
                        onChange={(e) => setNewPlatform(p => ({ ...p, platform_id: e.target.value }))}
                        placeholder="platform id (e.g. deezer)"
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/50"
                    />
                    <input
                        value={newPlatform.display_name}
                        onChange={(e) => setNewPlatform(p => ({ ...p, display_name: e.target.value }))}
                        placeholder="Display name (e.g. Deezer)"
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/50"
                    />
                    <input
                        value={newPlatform.description}
                        onChange={(e) => setNewPlatform(p => ({ ...p, description: e.target.value }))}
                        placeholder="Short description"
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/50 md:col-span-2"
                    />
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Brand color</label>
                        <input
                            type="color"
                            value={newPlatform.color}
                            onChange={(e) => setNewPlatform(p => ({ ...p, color: e.target.value }))}
                            className="size-9 rounded-lg bg-transparent border border-white/10 cursor-pointer"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {(['music', 'video', 'social'] as const).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setNewPlatform(p => ({ ...p, category: cat }))}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-xs font-bold transition-all',
                                    newPlatform.category === cat
                                        ? 'bg-white text-black'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleAddPlatform}
                        disabled={!newPlatform.platform_id.trim() || !newPlatform.display_name.trim()}
                        className="md:col-span-2 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                    >
                        Create Platform
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(platformConfigs || []).map((cfg) => (
                    <div
                        key={cfg.id}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
                    >
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
                                <Plug className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-white font-bold flex items-center gap-2 truncate">
                                    {cfg.display_name}
                                    <span className={cn(
                                        'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border shrink-0',
                                        cfg.has_adapter
                                            ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                                            : 'text-slate-400 bg-white/5 border-white/10'
                                    )}>
                                        {cfg.has_adapter ? 'Live' : 'Coming Soon'}
                                    </span>
                                </h3>
                                <p className="text-slate-500 text-xs truncate">{cfg.platform_id} · {cfg.category}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => handleTogglePlatform(cfg)}
                                disabled={platformBusyId === cfg.id}
                                className={cn(
                                    'relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50',
                                    cfg.enabled ? 'bg-emerald-500' : 'bg-white/10'
                                )}
                                title={cfg.enabled ? 'Disable platform' : 'Enable platform'}
                            >
                                <div className={cn(
                                    'absolute top-1 size-4 bg-white shadow rounded-full transition-transform',
                                    cfg.enabled ? 'translate-x-7' : 'translate-x-1'
                                )} />
                            </button>
                            {!cfg.has_adapter && (
                                <button
                                    onClick={() => handleDeletePlatform(cfg.id)}
                                    disabled={platformBusyId === cfg.id}
                                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                    title="Remove platform"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
