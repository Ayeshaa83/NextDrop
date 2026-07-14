'use client';

import { useState } from 'react';
import { useRequireAdmin } from '@/lib/auth';
import { useAdminStats, usePendingTracks, useAdminPayouts, useAdminArtists, usePlatformAnalytics, usePlatformConfigs, formatNumber } from '@/lib/hooks';
import { adminApi, ApprovalAction, PlatformConfigInput } from '@/lib/api';
import { Shield, RefreshCw, Music, Check, X, Play, Info, Users, Mic2, Banknote, BadgeCheck, LineChart as LineChartIcon, Plug, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayer } from '@/lib/playerStore';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';

export default function AdminDashboard() {
    const { user, isLoading: authLoading, isAdmin } = useRequireAdmin();
    const { data: stats, loading: statsLoading, refetch: refetchStats } = useAdminStats();
    const { data: pendingTracks, loading: tracksLoading, refetch: refetchTracks } = usePendingTracks();
    const { data: payouts, refetch: refetchPayouts } = useAdminPayouts();
    const { data: artists, refetch: refetchArtists } = useAdminArtists();
    const { data: platformAnalytics } = usePlatformAnalytics(30);
    const { playTracks } = usePlayer();

    const [verifyProcessingId, setVerifyProcessingId] = useState<number | null>(null);

    const handleVerify = async (artistId: number, verified: boolean) => {
        setVerifyProcessingId(artistId);
        try {
            await adminApi.setArtistVerification(artistId, verified);
            refetchArtists();
        } catch (err) {
            console.error('Failed to update verification:', err);
        } finally {
            setVerifyProcessingId(null);
        }
    };

    const handleArtistApproval = async (artistId: number, approval: 'approved' | 'rejected', notes?: string) => {
        setVerifyProcessingId(artistId);
        try {
            await adminApi.setArtistApproval(artistId, approval, notes);
            refetchArtists();
        } catch (err) {
            console.error('Failed to update artist approval:', err);
        } finally {
            setVerifyProcessingId(null);
        }
    };

    const [artistRejectNotes, setArtistRejectNotes] = useState('');
    const [showArtistRejectModal, setShowArtistRejectModal] = useState<number | null>(null);

    const { data: platformConfigs, refetch: refetchPlatforms } = usePlatformConfigs();
    const [platformBusyId, setPlatformBusyId] = useState<number | null>(null);
    const [showAddPlatform, setShowAddPlatform] = useState(false);
    const [newPlatform, setNewPlatform] = useState<PlatformConfigInput>({
        platform_id: '', display_name: '', description: '', color: '#888888', category: 'music',
    });

    const handleTogglePlatform = async (cfg: { id: number } & PlatformConfigInput) => {
        setPlatformBusyId(cfg.id);
        try {
            await adminApi.updatePlatformConfig(cfg.id, { ...cfg, enabled: !cfg.enabled });
            refetchPlatforms();
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
            refetchPlatforms();
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
            refetchPlatforms();
        } catch (err) {
            console.error('Failed to add platform:', err);
        }
    };

    const [processingId, setProcessingId] = useState<number | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectModal, setShowRejectModal] = useState<number | null>(null);
    const [payoutProcessingId, setPayoutProcessingId] = useState<number | null>(null);

    const handlePayoutAction = async (payoutId: number, newStatus: 'completed' | 'rejected') => {
        setPayoutProcessingId(payoutId);
        try {
            await adminApi.updatePayoutStatus(payoutId, newStatus);
            refetchPayouts();
        } catch (err) {
            console.error('Failed to update payout:', err);
        } finally {
            setPayoutProcessingId(null);
        }
    };

    const loading = authLoading || statsLoading || tracksLoading;

    const handleApprove = async (trackId: number) => {
        setProcessingId(trackId);
        try {
            await adminApi.approveTrack(trackId, { status: 'approved' });
            refetchStats();
            refetchTracks();
        } catch (err) {
            console.error('Failed to approve track:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (trackId: number) => {
        setProcessingId(trackId);
        try {
            await adminApi.approveTrack(trackId, {
                status: 'rejected',
                notes: rejectNotes || 'Content policy violation'
            });
            setShowRejectModal(null);
            setRejectNotes('');
            refetchStats();
            refetchTracks();
        } catch (err) {
            console.error('Failed to reject track:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleMarkReview = async (trackId: number) => {
        setProcessingId(trackId);
        try {
            await adminApi.markUnderReview(trackId);
            refetchTracks();
        } catch (err) {
            console.error('Failed to mark track under review:', err);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
                    <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-slate-400">You don't have permission to access this page.</p>
                </div>
            </div>
        );
    }

    const trackItems = pendingTracks?.items || [];

    return (
        <>
            {/* Background */}
            <div className="absolute top-0 right-0 w-200 h-150 bg-primary/10 blur-[150px] rounded-full -z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-[-10%] w-150 h-125 bg-secondary/10 blur-[150px] rounded-full -z-10 pointer-events-none"></div>

            <div className="p-10 xl:p-14 max-w-7xl w-full mx-auto">
                <header className="flex justify-between items-end mb-12 animate-fade-in-up">
                    <div>
                        <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-2">System Administration</p>
                        <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-md">Admin Panel</h1>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5 backdrop-blur-md">
                        <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                            <Shield className="size-4 text-primary" />
                        </div>
                        <span className="text-slate-300 font-bold text-sm tracking-tight">{user?.email}</span>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10 animate-fade-in-up animate-delay-100">
                    <StatCard label="Total Users" value={stats?.total_users || 0} icon={Users} />
                    <StatCard label="Artists" value={stats?.total_artists || 0} icon={Mic2} />
                    <StatCard label="Total Tracks" value={stats?.total_tracks || 0} icon={Music} />
                    <StatCard label="Pending" value={stats?.pending_approvals || 0} icon={RefreshCw} color="yellow" />
                    <StatCard label="Approved" value={stats?.approved_tracks || 0} icon={Check} color="green" />
                    <StatCard label="Rejected" value={stats?.rejected_tracks || 0} icon={X} color="red" />
                </div>

                {/* Pending Tracks Section */}
                <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up animate-delay-200">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="material-symbols-outlined text-yellow-500">pending_actions</span>
                            Pending Approvals
                        </h2>
                        <button
                            onClick={() => refetchTracks()}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-semibold text-sm transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">refresh</span>
                            Refresh
                        </button>
                    </div>

                    {trackItems.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">task_alt</span>
                            <p className="text-slate-400 text-lg">No tracks pending approval</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {trackItems.map((track) => (
                                <div
                                    key={track.id}
                                    className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="size-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                            <Music className="size-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-lg">{track.title}</h3>
                                            <p className="text-slate-400 text-sm">
                                                by {track.artist_name || 'Unknown'} • {track.genre || 'No genre'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Play Preview */}
                                        <button
                                            onClick={() => track.file_url && playTracks([{
                                                id: track.id,
                                                title: track.title,
                                                artist: track.artist_name || 'Unknown Artist',
                                                url: track.file_url,
                                            }], 0)}
                                            disabled={!track.file_url}
                                            className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all disabled:opacity-40"
                                            title="Preview"
                                        >
                                            <span className="material-symbols-outlined text-white">play_arrow</span>
                                        </button>

                                        {/* Mark Under Review */}
                                        <button
                                            onClick={() => handleMarkReview(track.id)}
                                            disabled={processingId === track.id}
                                            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                                        >
                                            Review
                                        </button>

                                        {/* Reject */}
                                        <button
                                            onClick={() => setShowRejectModal(track.id)}
                                            disabled={processingId === track.id}
                                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                                        >
                                            Reject
                                        </button>

                                        {/* Approve */}
                                        <button
                                            onClick={() => handleApprove(track.id)}
                                            disabled={processingId === track.id}
                                            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {processingId === track.id ? (
                                                <span className="animate-spin">⏳</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-lg">check</span>
                                            )}
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Platform Analytics */}
                <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up animate-delay-200 mt-10">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                        <LineChartIcon className="size-6 text-primary" />
                        Platform Growth (30 days)
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-3 h-[220px] -ml-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={platformAnalytics?.points || []}>
                                    <defs>
                                        <linearGradient id="adminSignups" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="adminUploads" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date" stroke="#334155" fontSize={10} axisLine={false} tickLine={false}
                                        tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    />
                                    <YAxis stroke="#334155" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                                    <Area type="monotone" dataKey="signups" stroke="#6366f1" fill="url(#adminSignups)" name="Signups" strokeWidth={2} />
                                    <Area type="monotone" dataKey="uploads" stroke="#10b981" fill="url(#adminUploads)" name="Uploads" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Approval Funnel</p>
                            {Object.entries(platformAnalytics?.approval_funnel || {}).map(([status, count]) => (
                                <div key={status} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <span className="text-xs font-bold text-slate-300 capitalize">{status.replace('_', ' ')}</span>
                                    <span className="text-sm font-black text-white tabular-nums">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Artist Verification */}
                <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up animate-delay-300 mt-10">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <BadgeCheck className="size-6 text-sky-400" />
                            Artist Verification
                        </h2>
                        <button
                            onClick={() => refetchArtists()}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-semibold text-sm transition-all flex items-center gap-2"
                        >
                            <RefreshCw className="size-4" />
                            Refresh
                        </button>
                    </div>

                    {(artists?.items || []).length === 0 ? (
                        <p className="text-slate-400 text-center py-8">No artist profiles yet</p>
                    ) : (
                        <div className="space-y-3">
                            {(artists?.items || []).map((artist) => (
                                <div
                                    key={artist.id}
                                    className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                            <Mic2 className="size-5 text-sky-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold flex items-center gap-2">
                                                {artist.stage_name}
                                                {artist.is_verified && <BadgeCheck className="size-4 text-sky-400" />}
                                                <span className={cn(
                                                    'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border',
                                                    artist.approval_status === 'approved' && 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                                                    artist.approval_status === 'pending' && 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                                                    artist.approval_status === 'rejected' && 'text-red-400 bg-red-400/10 border-red-400/20',
                                                )}>
                                                    {artist.approval_status}
                                                </span>
                                            </h3>
                                            <p className="text-slate-400 text-sm">
                                                {artist.user_email || `User #${artist.user_id}`} · {artist.track_count} tracks
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {artist.approval_status !== 'approved' && (
                                            <button
                                                onClick={() => handleArtistApproval(artist.id, 'approved')}
                                                disabled={verifyProcessingId === artist.id}
                                                className="px-4 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 font-semibold text-sm transition-all disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                        )}
                                        {artist.approval_status === 'pending' && (
                                            <button
                                                onClick={() => setShowArtistRejectModal(artist.id)}
                                                disabled={verifyProcessingId === artist.id}
                                                className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold text-sm transition-all disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleVerify(artist.id, !artist.is_verified)}
                                            disabled={verifyProcessingId === artist.id}
                                            className={cn(
                                                'px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50',
                                                artist.is_verified
                                                    ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                                                    : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-400'
                                            )}
                                        >
                                            {artist.is_verified ? 'Revoke Badge' : 'Verify Artist'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Platform Management */}
                <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up animate-delay-300 mt-10">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Plug className="size-6 text-primary" />
                            Platform Management
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
                        Added platforms appear as "Coming Soon" until an integration adapter is built for them.
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

                {/* Payout Management */}
                <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up animate-delay-300 mt-10">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Banknote className="size-6 text-emerald-400" />
                            Payout Requests
                        </h2>
                        <button
                            onClick={() => refetchPayouts()}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-semibold text-sm transition-all flex items-center gap-2"
                        >
                            <RefreshCw className="size-4" />
                            Refresh
                        </button>
                    </div>

                    {(payouts?.items || []).length === 0 ? (
                        <div className="text-center py-12">
                            <Banknote className="size-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 text-lg">No payout requests</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(payouts?.items || []).map((payout) => (
                                <div
                                    key={payout.id}
                                    className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                            <Banknote className="size-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold">${payout.amount.toFixed(2)}</h3>
                                            <p className="text-slate-400 text-sm">
                                                {payout.user_email || `User #${payout.user_id}`} · {payout.method}
                                                {payout.reference && <span className="text-slate-600"> · {payout.reference}</span>}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border',
                                            payout.status === 'processing' && 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                                            payout.status === 'completed' && 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                                            payout.status === 'rejected' && 'text-red-400 bg-red-400/10 border-red-400/20',
                                        )}>
                                            {payout.status}
                                        </span>
                                        {payout.status === 'processing' && (
                                            <>
                                                <button
                                                    onClick={() => handlePayoutAction(payout.id, 'rejected')}
                                                    disabled={payoutProcessingId === payout.id}
                                                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handlePayoutAction(payout.id, 'completed')}
                                                    disabled={payoutProcessingId === payout.id}
                                                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                                                >
                                                    Mark Paid
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Reject Artist Modal */}
            {showArtistRejectModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#0a0a12] border border-white/10 rounded-3xl p-8 max-w-md w-full mx-4">
                        <h3 className="text-2xl font-bold text-white mb-4">Reject Artist Profile</h3>
                        <p className="text-slate-400 mb-6">Optionally tell the artist why (they'll see this in-app and by email):</p>
                        <textarea
                            value={artistRejectNotes}
                            onChange={(e) => setArtistRejectNotes(e.target.value)}
                            placeholder="e.g., Incomplete profile, policy violation..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-slate-500 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all resize-none h-32"
                        />
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowArtistRejectModal(null);
                                    setArtistRejectNotes('');
                                }}
                                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await handleArtistApproval(showArtistRejectModal, 'rejected', artistRejectNotes || undefined);
                                    setShowArtistRejectModal(null);
                                    setArtistRejectNotes('');
                                }}
                                disabled={verifyProcessingId !== null}
                                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#0a0a12] border border-white/10 rounded-3xl p-8 max-w-md w-full mx-4">
                        <h3 className="text-2xl font-bold text-white mb-4">Reject Track</h3>
                        <p className="text-slate-400 mb-6">Please provide a reason for rejection:</p>
                        <textarea
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="e.g., Copyright infringement, inappropriate content..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-slate-500 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all resize-none h-32"
                        />
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowRejectModal(null);
                                    setRejectNotes('');
                                }}
                                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReject(showRejectModal)}
                                disabled={processingId !== null}
                                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function StatCard({ label, value, icon: Icon, color = 'white' }: { label: string; value: number; icon: any; color?: string }) {
    const colorClasses = {
        white: 'text-white',
        yellow: 'text-yellow-400',
        green: 'text-green-400',
        red: 'text-red-400',
    };

    const bgClasses = {
        white: 'bg-white/10',
        yellow: 'bg-yellow-400/20',
        green: 'bg-green-400/20',
        red: 'bg-red-400/20',
    };

    return (
        <div className="glass-card rounded-2xl p-5 border border-white/5 transition-transform hover:scale-105">
            <div className="flex items-center gap-3 mb-3">
                <div className={cn("size-8 rounded-lg flex items-center justify-center", bgClasses[color as keyof typeof bgClasses])}>
                    <Icon className={cn("size-4", colorClasses[color as keyof typeof colorClasses])} />
                </div>
                <span className="text-slate-400 text-[10px] font-black tracking-widest uppercase">{label}</span>
            </div>
            <p className={cn("text-3xl font-black", colorClasses[color as keyof typeof colorClasses])}>
                {formatNumber(value)}
            </p>
        </div>
    );
}
