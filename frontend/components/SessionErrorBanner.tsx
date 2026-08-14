'use client';

import { AlertCircle, RefreshCw, LogIn } from 'lucide-react';

/**
 * Shown instead of a silent "empty" state when a data fetch failed. A 401
 * here means the page rendered ahead of (or instead of) useRequireAuth's
 * redirect — the underlying data is very likely still there; the session
 * just isn't valid right now. Distinguishing this from "genuinely no data
 * yet" avoids it reading as data loss.
 */
export default function SessionErrorBanner({
    isAuthError,
    onRetry,
}: {
    isAuthError: boolean;
    onRetry: () => void;
}) {
    if (isAuthError) {
        return (
            <div className="card-premium p-8 flex flex-col items-center gap-3 text-center border-dashed border-2 border-amber-500/20">
                <AlertCircle className="size-8 text-amber-400" />
                <div>
                    <h3 className="text-white font-bold text-sm">Your session has expired</h3>
                    <p className="text-slate-400 text-xs mt-1 max-w-sm">
                        This isn&apos;t empty — you&apos;re just logged out. Log back in to see it again.
                    </p>
                </div>
                <a
                    href="/login"
                    className="mt-1 px-6 py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                >
                    <LogIn className="size-3.5" />
                    Log In Again
                </a>
            </div>
        );
    }

    return (
        <div className="card-premium p-8 flex flex-col items-center gap-3 text-center border-dashed border-2 border-red-500/20">
            <AlertCircle className="size-8 text-red-400" />
            <p className="text-sm text-red-300 font-medium">Couldn&apos;t load this right now.</p>
            <button
                onClick={onRetry}
                className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-colors"
            >
                <RefreshCw className="size-3.5" />
                Retry
            </button>
        </div>
    );
}
