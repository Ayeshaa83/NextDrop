'use client';

import { useState, useMemo } from 'react';
import { useAdminArtists } from '@/lib/hooks';
import { adminApi } from '@/lib/api';
import { RefreshCw, Mic2, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminSearchInput } from '../_components';

export default function ArtistVerificationPage() {
    const { data: artists, refetch } = useAdminArtists();

    const [search, setSearch] = useState('');
    const [verifyProcessingId, setVerifyProcessingId] = useState<number | null>(null);
    const [artistRejectNotes, setArtistRejectNotes] = useState('');
    const [showArtistRejectModal, setShowArtistRejectModal] = useState<number | null>(null);

    const artistItems = artists?.items || [];
    const q = search.trim().toLowerCase();
    const filteredArtists = useMemo(() => (
        q
            ? artistItems.filter((a) =>
                a.stage_name.toLowerCase().includes(q) || (a.user_email || '').toLowerCase().includes(q))
            : artistItems
    ), [artistItems, q]);

    const handleVerify = async (artistId: number, verified: boolean) => {
        setVerifyProcessingId(artistId);
        try {
            await adminApi.setArtistVerification(artistId, verified);
            refetch();
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
            refetch();
        } catch (err) {
            console.error('Failed to update artist approval:', err);
        } finally {
            setVerifyProcessingId(null);
        }
    };

    return (
        <>
            <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up">
                <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <BadgeCheck className="size-6 text-sky-400" />
                        Artists
                    </h2>
                    <div className="flex items-center gap-3">
                        <AdminSearchInput value={search} onChange={setSearch} placeholder="Search by stage name or email..." />
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-semibold text-sm transition-all flex items-center gap-2 shrink-0"
                        >
                            <RefreshCw className="size-4" />
                            Refresh
                        </button>
                    </div>
                </div>

                {filteredArtists.length === 0 ? (
                    <p className="text-slate-400 text-center py-12">
                        {artistItems.length === 0 ? 'No artist profiles yet' : `No artists match "${search}"`}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {filteredArtists.map((artist) => (
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

            {/* Reject Artist Modal */}
            {showArtistRejectModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#0a0a12] border border-white/10 rounded-3xl p-8 max-w-md w-full mx-4">
                        <h3 className="text-2xl font-bold text-white mb-4">Reject Artist Profile</h3>
                        <p className="text-slate-400 mb-6">Optionally tell the artist why (they&apos;ll see this in-app and by email):</p>
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
        </>
    );
}
