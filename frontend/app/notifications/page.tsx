'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useRequireAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { notificationsApi, AppNotification } from '@/lib/api';
import { NOTIFICATION_ICONS, NOTIFICATION_ACCENT, timeAgo } from '@/components/NotificationBell';

const PAGE_SIZE = 30;

export default function NotificationsPage() {
    const router = useRouter();
    const { isLoading: authLoading } = useRequireAuth();

    const [items, setItems] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const load = useCallback(async (skip: number, append: boolean) => {
        if (append) setLoadingMore(true); else setLoading(true);
        try {
            const page = await notificationsApi.getAll(skip, PAGE_SIZE);
            setItems((prev) => (append ? [...prev, ...page.items] : page.items));
            setHasMore(page.has_more);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        load(0, false);
    }, [load]);

    const handleClick = async (n: AppNotification) => {
        if (!n.is_read) {
            try {
                await notificationsApi.markRead(n.id);
                setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
            } catch {
                // non-fatal
            }
        }
        if (n.link) router.push(n.link);
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
        } catch {
            // non-fatal
        }
    };

    const unreadCount = items.filter((n) => !n.is_read).length;

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
    const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

    if (authLoading) return null;

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-3xl mx-auto space-y-8 pb-32"
        >
            <motion.header variants={item} className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase">Inbox</p>
                    <h1 className="text-4xl font-black tracking-tight text-white">Notifications</h1>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <CheckCheck className="size-4" />
                        Mark all read
                    </button>
                )}
            </motion.header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="size-10 border-2 border-primary border-t-transparent rounded-full"
                    />
                </div>
            ) : items.length === 0 ? (
                <motion.div
                    variants={item}
                    className="card-premium p-16 flex flex-col items-center gap-4 text-center border-dashed border-2 border-white/5"
                >
                    <Inbox className="size-10 text-slate-600" />
                    <p className="text-slate-400 font-medium">Nothing here yet. Approvals, collab requests, and payouts will show up here.</p>
                </motion.div>
            ) : (
                <motion.div variants={item} className="card-premium overflow-hidden divide-y divide-white/[0.03]">
                    {items.map((n) => {
                        const Icon = NOTIFICATION_ICONS[n.type] || Bell;
                        return (
                            <button
                                key={n.id}
                                onClick={() => handleClick(n)}
                                className={cn(
                                    'w-full text-left p-5 flex items-start gap-4 hover:bg-white/5 transition-colors',
                                    !n.is_read && 'bg-primary/[0.03]'
                                )}
                            >
                                <div className={cn('size-11 rounded-xl flex items-center justify-center shrink-0', NOTIFICATION_ACCENT[n.type])}>
                                    <Icon className="size-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className={cn('text-sm font-bold', n.is_read ? 'text-slate-300' : 'text-white')}>
                                            {n.title}
                                        </p>
                                        {!n.is_read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                                    </div>
                                    {n.body && <p className="text-xs text-slate-500 font-medium mt-1">{n.body}</p>}
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-2">
                                        {timeAgo(n.created_at)}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </motion.div>
            )}

            {hasMore && !loading && (
                <div className="flex justify-center">
                    <button
                        onClick={() => load(items.length, true)}
                        disabled={loadingMore}
                        className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}
        </motion.div>
    );
}
