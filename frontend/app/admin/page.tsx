'use client';

import { useState } from 'react';
import { useRequireAdmin } from '@/lib/auth';
import { useAdminStats, usePendingTracks, formatNumber } from '@/lib/hooks';
import { adminApi, ApprovalAction } from '@/lib/api';
import { Shield, RefreshCw, Music, Check, X, Play, Info, Users, Mic2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
    const { user, isLoading: authLoading, isAdmin } = useRequireAdmin();
    const { data: stats, loading: statsLoading, refetch: refetchStats } = useAdminStats();
    const { data: pendingTracks, loading: tracksLoading, refetch: refetchTracks } = usePendingTracks();

    const [processingId, setProcessingId] = useState<number | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectModal, setShowRejectModal] = useState<number | null>(null);

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
                                            className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
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
            </div>

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
