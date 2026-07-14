'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { authApi, ApiError } from '@/lib/api';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (status === 'saving') return;
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        setStatus('saving');
        setError(null);
        try {
            await authApi.resetPassword(token, password);
            setStatus('done');
            setTimeout(() => router.push('/login'), 2500);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
            setStatus('idle');
        }
    };

    if (!token) {
        return (
            <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <AlertCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-100">
                    This reset link is missing its token. Please use the link from your email,
                    or <Link href="/forgot-password" className="underline font-bold">request a new one</Link>.
                </p>
            </div>
        );
    }

    if (status === 'done') {
        return (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-100">
                    Password updated! Redirecting you to the login page…
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-200">{error}</p>
                </div>
            )}
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password (min 8 characters)"
                    className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white text-sm font-medium outline-none focus:border-primary/50 transition-colors"
                />
            </div>
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white text-sm font-medium outline-none focus:border-primary/50 transition-colors"
                />
            </div>
            <button
                type="submit"
                disabled={status === 'saving'}
                className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
            >
                {status === 'saving' ? (
                    <>Saving... <Loader2 className="size-4 animate-spin" /></>
                ) : (
                    'Set new password'
                )}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md card-premium p-10 space-y-6 border border-white/5"
            >
                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-white">Choose a new password</h1>
                    <p className="text-sm text-slate-400 font-medium">
                        Enter and confirm your new NextDrop password.
                    </p>
                </div>
                <Suspense fallback={<div className="text-slate-500 text-sm">Loading…</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </motion.div>
        </div>
    );
}
