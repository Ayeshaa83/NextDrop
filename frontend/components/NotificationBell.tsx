'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    CheckCheck,
    Music,
    Mic2,
    Banknote,
    BadgeCheck,
    Handshake,
    Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationsApi, AppNotification, NotificationType } from '@/lib/api';
import { useUnreadNotificationCount, useNotifications } from '@/lib/hooks';

const ICONS: Record<NotificationType, typeof Music> = {
    track_approved: Music,
    track_rejected: Music,
    artist_approved: Mic2,
    artist_rejected: Mic2,
    payout_completed: Banknote,
    payout_rejected: Banknote,
    verification_granted: BadgeCheck,
    collab_request: Handshake,
};

const ACCENT: Record<NotificationType, string> = {
    track_approved: 'text-emerald-400 bg-emerald-400/10',
    track_rejected: 'text-red-400 bg-red-400/10',
    artist_approved: 'text-emerald-400 bg-emerald-400/10',
    artist_rejected: 'text-red-400 bg-red-400/10',
    payout_completed: 'text-emerald-400 bg-emerald-400/10',
    payout_rejected: 'text-amber-400 bg-amber-400/10',
    verification_granted: 'text-sky-400 bg-sky-400/10',
    collab_request: 'text-secondary bg-secondary/10',
};

function timeAgo(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const { count, refetch: refetchCount } = useUnreadNotificationCount();
    const { data: notifications, loading, refetch: refetchList } = useNotifications();

    const handleOpen = () => {
        setIsOpen((open) => !open);
        if (!isOpen) refetchList();
    };

    const handleClickNotification = async (n: AppNotification) => {
        if (!n.is_read) {
            try {
                await notificationsApi.markRead(n.id);
                refetchCount();
                refetchList();
            } catch {
                // non-fatal
            }
        }
        setIsOpen(false);
        if (n.link) router.push(n.link);
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            refetchCount();
            refetchList();
        } catch {
            // non-fatal
        }
    };

    const items = notifications?.items || [];

    return (
        <div className="relative">
            <button
                onClick={handleOpen}
                className="relative text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
                <Bell className="size-5" />
                {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-primary rounded-full border-2 border-[#050505] text-[9px] font-black text-white">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-3 w-96 max-h-[28rem] bg-[#0a0a0b] border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden flex flex-col"
                        >
                            <div className="p-4 flex items-center justify-between border-b border-white/5 shrink-0">
                                <h3 className="text-sm font-black text-white">Notifications</h3>
                                {count > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
                                    >
                                        <CheckCheck className="size-3.5" />
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                {loading ? (
                                    <div className="p-8 text-center text-xs text-slate-500 font-medium">Loading...</div>
                                ) : items.length === 0 ? (
                                    <div className="p-10 flex flex-col items-center gap-3 text-center">
                                        <Inbox className="size-8 text-slate-700" />
                                        <p className="text-xs text-slate-500 font-medium">No notifications yet.</p>
                                    </div>
                                ) : (
                                    items.map((n) => {
                                        const Icon = ICONS[n.type] || Bell;
                                        return (
                                            <button
                                                key={n.id}
                                                onClick={() => handleClickNotification(n)}
                                                className={cn(
                                                    'w-full text-left p-4 flex items-start gap-3 border-b border-white/[0.03] hover:bg-white/5 transition-colors',
                                                    !n.is_read && 'bg-primary/[0.03]'
                                                )}
                                            >
                                                <div className={cn('size-9 rounded-xl flex items-center justify-center shrink-0', ACCENT[n.type])}>
                                                    <Icon className="size-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className={cn('text-xs font-bold truncate', n.is_read ? 'text-slate-300' : 'text-white')}>
                                                            {n.title}
                                                        </p>
                                                        {!n.is_read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                                                    </div>
                                                    {n.body && (
                                                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-2">{n.body}</p>
                                                    )}
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-1.5">
                                                        {timeAgo(n.created_at)}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
