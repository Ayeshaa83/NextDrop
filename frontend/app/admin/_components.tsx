'use client';

import Link from 'next/link';
import { Search, X, ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatCard({ label, value, icon: Icon, color = 'white' }: { label: string; value: number; icon: LucideIcon; color?: string }) {
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
                {value.toLocaleString()}
            </p>
        </div>
    );
}

export function AdminNavCard({ href, label, description, icon: Icon, count }: {
    href: string; label: string; description: string; icon: LucideIcon; count?: number;
}) {
    return (
        <Link
            href={href}
            className="glass-card rounded-2xl p-5 border border-white/5 hover:border-primary/30 hover:-translate-y-0.5 transition-all flex items-center gap-4 group"
        >
            <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Icon className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold text-sm truncate">{label}</h3>
                    {typeof count === 'number' && count > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary rounded-full text-[9px] font-black text-white shrink-0">
                            {count > 99 ? '99+' : count}
                        </span>
                    )}
                </div>
                <p className="text-slate-500 text-xs truncate">{description}</p>
            </div>
            <ChevronRight className="size-4 text-slate-600 group-hover:text-primary transition-colors shrink-0" />
        </Link>
    );
}

export function AdminSearchInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder: string;
}) {
    return (
        <div className="relative w-full max-w-xs">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
    );
}
