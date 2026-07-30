'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    Compass,
    Trophy,
    Users,
    Library,
    Mic2,
    Settings,
    LogOut,
    Shield,
    Sparkles,
    UploadCloud,
    BarChart3,
    Link2,
    Wallet
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { useCollabUnreadCount } from '../lib/hooks';
import { motion } from 'framer-motion';

export default function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { count: collabUnreadCount } = useCollabUnreadCount();

    // Hide on Auth pages
    if (['/login', '/signup', '/forgot-password', '/reset-password'].includes(pathname)) {
        return null;
    }

    // Admins get a clean, admin-only menu — no artist features
    const adminSections = [
        {
            title: 'ADMINISTRATION',
            items: [
                { name: 'Admin Panel', href: '/admin', icon: Shield },
            ]
        },
    ];

    const artistSections = [
        {
            title: 'PLATFORM',
            items: [
                { name: 'Home', href: '/', icon: Home },
                { name: 'Explore', href: '/explore', icon: Compass },
                { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
            ]
        },
        {
            title: 'CREATION',
            items: [
                { name: 'Upload Release', href: '/upload', icon: UploadCloud },
                { name: 'Jam Jar', href: '/jamjar', icon: Users },
            ]
        },
        {
            title: 'LIBRARY',
            items: [
                { name: 'My Tracks', href: '/music', icon: Library },
                { name: 'Collabs', href: '/collabs', icon: Mic2 },
            ]
        },
        {
            title: 'ANALYTICS',
            items: [
                { name: 'Deep Analytics', href: '/analytics', icon: BarChart3 },
                { name: 'Earnings', href: '/earnings', icon: Wallet },
                { name: 'Growth Suite', href: '/marketing', icon: Sparkles },
            ]
        },
        {
            title: 'SYSTEM',
            items: [
                { name: 'Integrations', href: '/integrations', icon: Link2 },
                { name: 'Settings', href: '/settings', icon: Settings },
            ]
        }
    ];

    const sections = user?.role === 'admin' ? adminSections : artistSections;

    return (
        <aside className="w-[240px] flex flex-col py-6 border-r border-border-dark bg-bg-deep shrink-0 h-full z-30">
            <div className="px-6 mb-4 overflow-hidden">
                <Link href="/" className="flex items-center gap-2 transition-transform active:scale-95 group">
                    <div className="size-9 flex items-center justify-center transition-transform group-hover:rotate-[5deg] shrink-0">
                        <img src="/logo.png" alt="NextDrop Logo" className="size-full object-contain" />
                    </div>
                    <span className="font-extrabold text-lg tracking-tight text-white">NextDrop</span>
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-8 overflow-y-auto">
                {sections.map((section) => (
                    <div key={section.title} className="space-y-2">
                        <h3 className="px-4 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">
                            {section.title}
                        </h3>
                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "sidebar-link relative group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out active:scale-95 overflow-hidden",
                                            isActive
                                                ? "bg-white/5 text-white"
                                                : "text-slate-500 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "size-5 transition-colors relative z-10",
                                            isActive ? "text-primary" : "text-slate-500 group-hover:text-white"
                                        )} strokeWidth={isActive ? 2.5 : 2} />
                                        <span className="text-sm font-bold tracking-tight relative z-10">{item.name}</span>
                                        {item.href === '/collabs' && collabUnreadCount > 0 && (
                                            <span className="ml-auto relative z-10 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary rounded-full text-[9px] font-black text-white">
                                                {collabUnreadCount > 9 ? '9+' : collabUnreadCount}
                                            </span>
                                        )}
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeNavPill"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
