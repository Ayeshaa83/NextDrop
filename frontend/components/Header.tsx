'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, LogOut, Settings, UserCircle, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DEFAULT_AVATAR } from '@/lib/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from '@/components/NotificationBell';

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, artist, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const isAdmin = user?.role === 'admin';

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = searchQuery.trim();
        router.push(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
    };

    // Keyboard shortcut hint (CMD+K / CTRL+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('global-search')?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (pathname === '/login' || pathname === '/signup' || pathname === '/onboarding') {
        return null;
    }

    return (
        <header className="sticky top-0 z-40 w-full bg-black/40 backdrop-blur-xl border-b border-white/5 py-4 px-8 flex items-center justify-between">
            {/* Search Bar — admins get focused per-page filters instead (no site-wide artist/music search applies to them) */}
            {isAdmin ? (
                <div />
            ) : (
                <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500 group-focus-within:text-white transition-colors" />
                    <input
                        id="global-search"
                        type="text"
                        placeholder="Search artists..."
                        className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-white/10 focus:bg-white/10 transition-all placeholder:text-slate-600"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-black text-slate-500">
                        <span className="text-[12px]">⌘</span>K
                    </div>
                </form>
            )}

            {/* Right Side Actions */}
            <div className="flex items-center gap-6">
                <NotificationBell />

                {/* Admins have no artist profile — show a plain identity badge; logout lives in the sidebar */}
                {isAdmin ? (
                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <div className="size-7 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                            <Shield className="size-3.5 text-primary" />
                        </div>
                        <span className="hidden lg:block text-xs font-bold text-slate-300">{user?.email}</span>
                    </div>
                ) : (
                <div className="relative">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-3 p-1 rounded-full hover:bg-white/5 transition-all cursor-pointer group"
                    >
                        <div className="size-8 rounded-full border border-white/10 overflow-hidden ring-1 ring-primary/20 group-hover:ring-primary/50 transition-all">
                            <img
                                src={artist?.profile_picture || DEFAULT_AVATAR}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="hidden lg:block text-left pr-2">
                            <p className="text-xs font-bold text-white leading-none mb-0.5">{artist?.stage_name || 'Artist'}</p>
                            <p className="text-[10px] font-medium text-slate-500 leading-none">{user?.email}</p>
                        </div>
                    </button>

                    <AnimatePresence>
                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 mt-3 w-56 bg-[#0a0a0b] border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden"
                                >
                                    <div className="p-2 space-y-1">
                                        <Link
                                            href="/account"
                                            onClick={() => setIsMenuOpen(false)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                                        >
                                            <UserCircle className="size-4" />
                                            <span className="text-sm font-bold">Artist Profile</span>
                                        </Link>
                                        <Link
                                            href="/settings"
                                            onClick={() => setIsMenuOpen(false)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                                        >
                                            <Settings className="size-4" />
                                            <span className="text-sm font-bold">Account Settings</span>
                                        </Link>
                                        <div className="h-px bg-white/5 mx-2 my-1" />
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                                        >
                                            <LogOut className="size-4" />
                                            <span className="text-sm font-bold">Logout Session</span>
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
                )}
            </div>
        </header>
    );
}
