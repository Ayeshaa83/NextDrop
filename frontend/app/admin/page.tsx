'use client';

import { useAdminStats, usePlatformAnalytics, formatNumber } from '@/lib/hooks';
import { Music, Check, X, RefreshCw, Users, Mic2, LineChart as LineChartIcon, BadgeCheck, Plug, Banknote } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { StatCard, AdminNavCard } from './_components';

export default function AdminDashboard() {
    const { data: stats, loading: statsLoading } = useAdminStats();
    const { data: platformAnalytics } = usePlatformAnalytics(30);

    if (statsLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-fade-in-up">
                <StatCard label="Total Users" value={stats?.total_users || 0} icon={Users} />
                <StatCard label="Artists" value={stats?.total_artists || 0} icon={Mic2} />
                <StatCard label="Total Tracks" value={stats?.total_tracks || 0} icon={Music} />
                <StatCard label="Pending" value={stats?.pending_approvals || 0} icon={RefreshCw} color="yellow" />
                <StatCard label="Approved" value={stats?.approved_tracks || 0} icon={Check} color="green" />
                <StatCard label="Rejected" value={stats?.rejected_tracks || 0} icon={X} color="red" />
            </div>

            {/* Platform Analytics */}
            <div className="glass-card rounded-3xl p-8 border border-white/5 animate-fade-in-up">
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
                                <span className="text-sm font-black text-white tabular-nums">{formatNumber(count)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Navigation */}
            <div className="animate-fade-in-up">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Manage</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AdminNavCard
                        href="/admin/approvals"
                        label="Pending Approvals"
                        description="Review and approve or reject submitted tracks"
                        icon={Music}
                        count={stats?.pending_approvals}
                    />
                    <AdminNavCard
                        href="/admin/verification"
                        label="Artist Verification"
                        description="Approve new artist profiles and grant verified badges"
                        icon={BadgeCheck}
                    />
                    <AdminNavCard
                        href="/admin/platforms"
                        label="Platform Management"
                        description="Enable, disable, or add distribution platforms"
                        icon={Plug}
                    />
                    <AdminNavCard
                        href="/admin/payouts"
                        label="Payout Requests"
                        description="Process or decline artist withdrawal requests"
                        icon={Banknote}
                    />
                </div>
            </div>
        </div>
    );
}
