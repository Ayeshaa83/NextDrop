'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet as WalletIcon,
    Download,
    Banknote,
    TrendingUp,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    X,
    Music2,
} from 'lucide-react';

import { useRequireAuth } from '@/lib/auth';
import { useWallet, useEarningsSummary, usePayoutHistory, formatNumber } from '@/lib/hooks';
import { earningsApi, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const usd = (n: number) => `$${n.toFixed(2)}`;

const PAYOUT_STATUS_STYLE: Record<string, string> = {
    processing: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function EarningsPage() {
    const { isLoading: authLoading } = useRequireAuth();
    const wallet = useWallet();
    const summary = useEarningsSummary();
    const payouts = usePayoutHistory();

    const [showWithdraw, setShowWithdraw] = useState(false);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('bank_transfer');
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawError, setWithdrawError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

    const loading = authLoading || wallet.loading || summary.loading;

    const refetchAll = () => {
        wallet.refetch();
        payouts.refetch();
    };

    const handleWithdraw = async () => {
        const value = Number(amount);
        if (!value || value <= 0) {
            setWithdrawError('Enter a valid amount.');
            return;
        }
        setWithdrawing(true);
        setWithdrawError(null);
        try {
            await earningsApi.withdraw(value, method);
            setShowWithdraw(false);
            setAmount('');
            refetchAll();
        } catch (err) {
            setWithdrawError(err instanceof ApiError ? err.message : 'Withdrawal failed.');
        } finally {
            setWithdrawing(false);
        }
    };

    const handleStatement = async () => {
        setDownloading(true);
        try {
            await earningsApi.downloadStatement();
        } catch {
            // non-fatal
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="size-10 border-2 border-primary border-t-transparent rounded-full"
                />
            </div>
        );
    }

    const stats = [
        { label: 'Available Balance', value: usd(wallet.data?.balance ?? 0), icon: WalletIcon, accent: 'text-emerald-400' },
        { label: 'Lifetime Earnings', value: usd(wallet.data?.lifetime_earnings ?? 0), icon: TrendingUp, accent: 'text-primary' },
        { label: 'Withdrawn', value: usd(wallet.data?.withdrawn ?? 0), icon: Banknote, accent: 'text-slate-300' },
        { label: 'Pending Payouts', value: usd(wallet.data?.pending_payouts ?? 0), icon: Clock, accent: 'text-amber-400' },
    ];

    const trackRows = (summary.data?.tracks || []).filter(t => t.gross_revenue > 0);
    const platformTotals = summary.data?.platform_totals || {};

    return (
        <div className="p-8 lg:p-12 max-w-[1600px] mx-auto space-y-10 pb-32">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Royalty Center</p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Earnings &amp; Payouts</h1>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleStatement}
                        disabled={downloading}
                        className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        Statement
                    </button>
                    <button
                        onClick={() => setShowWithdraw(true)}
                        disabled={(wallet.data?.balance ?? 0) <= 0}
                        className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-primary/20 disabled:opacity-30 disabled:hover:scale-100"
                    >
                        <Banknote className="size-4" />
                        Withdraw
                    </button>
                </div>
            </header>

            {/* Wallet stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <div key={s.label} className="card-premium p-6 space-y-2">
                        <div className="flex items-center gap-2 text-slate-500">
                            <s.icon className="size-4" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{s.label}</span>
                        </div>
                        <p className={cn('text-3xl font-black tabular-nums', s.accent)}>{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Earnings table */}
                <div className="xl:col-span-2 space-y-4">
                    <h2 className="text-xl font-black text-white">Track Earnings</h2>
                    {trackRows.length === 0 ? (
                        <div className="card-premium p-10 flex flex-col items-center gap-3 text-center border-dashed border-2 border-white/5">
                            <Music2 className="size-8 text-slate-600" />
                            <p className="text-sm text-slate-400 font-medium max-w-sm">
                                No earnings yet. Distribute your tracks and refresh platform analytics to start
                                accumulating royalties.
                            </p>
                        </div>
                    ) : (
                        <div className="card-premium overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                        <th className="text-left px-6 py-4">Track</th>
                                        <th className="text-right px-4 py-4">Spotify</th>
                                        <th className="text-right px-4 py-4">YouTube</th>
                                        <th className="text-right px-4 py-4">Other</th>
                                        <th className="text-right px-4 py-4">Share</th>
                                        <th className="text-right px-6 py-4">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trackRows.map((t) => (
                                        <tr key={t.track_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-white font-bold">{t.title}</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-0.5">
                                                    {formatNumber(t.spotify_streams + t.youtube_views + t.other_streams)} total units
                                                </p>
                                            </td>
                                            <td className="text-right px-4 py-4 text-slate-300 tabular-nums">{usd(t.spotify_revenue)}</td>
                                            <td className="text-right px-4 py-4 text-slate-300 tabular-nums">{usd(t.youtube_revenue)}</td>
                                            <td className="text-right px-4 py-4 text-slate-300 tabular-nums">{usd(t.other_revenue)}</td>
                                            <td className="text-right px-4 py-4 text-slate-400 tabular-nums">{t.royalty_share}%</td>
                                            <td className="text-right px-6 py-4 text-emerald-400 font-bold tabular-nums">{usd(t.net_revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="text-[10px] font-black uppercase tracking-widest">
                                        <td className="px-6 py-4 text-slate-400">Lifetime Total</td>
                                        <td className="text-right px-4 py-4 text-slate-300 tabular-nums">{usd(platformTotals.spotify ?? 0)}</td>
                                        <td className="text-right px-4 py-4 text-slate-300 tabular-nums">{usd(platformTotals.youtube ?? 0)}</td>
                                        <td className="text-right px-4 py-4 text-slate-300 tabular-nums">{usd(platformTotals.other ?? 0)}</td>
                                        <td />
                                        <td className="text-right px-6 py-4 text-emerald-400 tabular-nums">{usd(summary.data?.lifetime_net ?? 0)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Payout history */}
                <div className="space-y-4">
                    <h2 className="text-xl font-black text-white">Payout History</h2>
                    {(payouts.data || []).length === 0 ? (
                        <div className="card-premium p-8 text-center border-dashed border-2 border-white/5">
                            <p className="text-sm text-slate-500 font-medium">No withdrawals yet.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {(payouts.data || []).map((p) => (
                                <div key={p.id} className="card-premium p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center">
                                            {p.status === 'completed' && <CheckCircle2 className="size-5 text-emerald-400" />}
                                            {p.status === 'processing' && <Clock className="size-5 text-amber-400" />}
                                            {p.status === 'rejected' && <XCircle className="size-5 text-red-400" />}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm tabular-nums">{usd(p.amount)}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-0.5">
                                                {p.reference || p.method} · {new Date(p.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        'text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border',
                                        PAYOUT_STATUS_STYLE[p.status]
                                    )}>
                                        {p.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Withdraw modal */}
            <AnimatePresence>
                {showWithdraw && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowWithdraw(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-white">Request Payout</h2>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                        Available: {usd(wallet.data?.balance ?? 0)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowWithdraw(false)}
                                    className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            {withdrawError && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <p className="text-xs text-red-200">{withdrawError}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Amount (USD)</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-[#070708] border border-white/[0.06] rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-primary/50 text-sm font-bold"
                                />
                                <button
                                    onClick={() => setAmount(String(wallet.data?.balance ?? 0))}
                                    className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
                                >
                                    Withdraw Max
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Method</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'bank_transfer', label: 'Bank Transfer' },
                                        { id: 'paypal', label: 'PayPal' },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setMethod(m.id)}
                                            className={cn(
                                                'py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors',
                                                method === m.id
                                                    ? 'bg-primary text-white border-transparent'
                                                    : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                                            )}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleWithdraw}
                                disabled={withdrawing}
                                className="w-full py-4 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {withdrawing ? (
                                    <>Processing... <Loader2 className="size-4 animate-spin" /></>
                                ) : (
                                    <>Confirm Withdrawal</>
                                )}
                            </button>
                            <p className="text-[9px] text-slate-600 text-center font-medium">
                                Payouts are simulated. An admin marks them as paid — no real money moves.
                            </p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
