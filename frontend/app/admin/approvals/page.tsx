'use client';

import { useState, useMemo } from 'react';
import { usePendingTracks } from '@/lib/hooks';
import { adminApi } from '@/lib/api';
import { Music, Play } from 'lucide-react';
import { usePlayer } from '@/lib/playerStore';
import { AdminSearchInput } from '../_components';

export default function PendingApprovalsPage() {
    const { data: pendingTracks, loading, refetch } = usePendingTracks();
    const { playTracks } = usePlayer();

    const [search, setSearch] = useState('');
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectModal, setShowRejectModal] = useState<number | null>(null);

    const trackItems = pendingTracks?.items || [];
    const q = search.trim().toLowerCase();
    const filteredTracks = useMemo(() => (
        q
            ? trackItems.filter((t) =>
                t.title.toLowerCase().includes(q) || (t.artist_name || '').toLowerCase().includes(q))
            : trackItems
    ), [trackItems, q]);

    const handleApprove = async (trackId: number) => {
        setProcessingId(trackId);
        try {
            await adminApi.approveTrack(trackId, { status: 'approved' });
            refetch();
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
            refetch();
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
            refetch();
        } catch (err) {
            console.error('Failed to mark track under review:', err);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <>
            <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up">
                <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-yellow-500">pending_actions</span>
                        Pending Tracks
                    </h2>
                    <div className="flex items-center gap-3">
                        <AdminSearchInput value={search} onChange={setSearch} placeholder="Search by track or artist..." />
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-semibold text-sm transition-all flex items-center gap-2 shrink-0"
                        >
                            <span className="material-symbols-outlined text-lg">refresh</span>
                            Refresh
                        </button>
                    </div>
                </div>

                {filteredTracks.length === 0 ? (
                    <div className="text-center py-12">
                        <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">task_alt</span>
                        <p className="text-slate-400 text-lg">
                            {trackItems.length === 0 ? 'No tracks pending approval' : `No tracks match "${search}"`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredTracks.map((track) => (
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
                                        <Play className="size-4 text-white" />
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
