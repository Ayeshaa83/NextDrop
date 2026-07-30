'use client';

import { useState, useMemo } from 'react';
import { useAdminPayouts } from '@/lib/hooks';
import { adminApi } from '@/lib/api';
import { RefreshCw, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminSearchInput } from '../_components';

export default function PayoutRequestsPage() {
    const { data: payouts, refetch } = useAdminPayouts();
    const [search, setSearch] = useState('');
    const [payoutProcessingId, setPayoutProcessingId] = useState<number | null>(null);

    const payoutItems = payouts?.items || [];
    const q = search.trim().toLowerCase();
    const filteredPayouts = useMemo(() => (
        q
            ? payoutItems.filter((p) =>
                (p.user_email || '').toLowerCase().includes(q) ||
                p.method.toLowerCase().includes(q) ||
                (p.reference || '').toLowerCase().includes(q))
            : payoutItems
    ), [payoutItems, q]);

    const handlePayoutAction = async (payoutId: number, newStatus: 'completed' | 'rejected') => {
        setPayoutProcessingId(payoutId);
        try {
            await adminApi.updatePayoutStatus(payoutId, newStatus);
            refetch();
        } catch (err) {
            console.error('Failed to update payout:', err);
        } finally {
            setPayoutProcessingId(null);
        }
    };

    return (
        <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Banknote className="size-6 text-emerald-400" />
                    Payouts
                </h2>
                <div className="flex items-center gap-3">
                    <AdminSearchInput value={search} onChange={setSearch} placeholder="Search by email, method, reference..." />
                    <button
                        onClick={() => refetch()}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-semibold text-sm transition-all flex items-center gap-2 shrink-0"
                    >
                        <RefreshCw className="size-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {filteredPayouts.length === 0 ? (
                <div className="text-center py-12">
                    <Banknote className="size-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">
                        {payoutItems.length === 0 ? 'No payout requests' : `No payouts match "${search}"`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredPayouts.map((payout) => (
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
    );
}
