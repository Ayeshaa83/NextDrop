'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { authApi, ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || status === 'sending') return;
        setStatus('sending');
        setError(null);
        try {
            await authApi.forgotPassword(email.trim());
            setStatus('sent');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
            setStatus('idle');
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md card-premium p-10 space-y-6 border border-white/5"
            >
                <Link
                    href="/login"
                    className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                    <ArrowLeft className="size-4" />
                    Back to login
                </Link>

                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-white">Forgot your password?</h1>
                    <p className="text-sm text-slate-400 font-medium">
                        Enter your account email and we&apos;ll send you a reset link.
                    </p>
                </div>

                {status === 'sent' ? (
                    <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-emerald-100 leading-relaxed">
                            If an account exists for <strong>{email}</strong>, a reset link is on its way.
                            The link expires in 30 minutes — check your spam folder too.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                <p className="text-xs text-red-200">{error}</p>
                            </div>
                        )}
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white text-sm font-medium outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={status === 'sending'}
                            className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {status === 'sending' ? (
                                <>Sending... <Loader2 className="size-4 animate-spin" /></>
                            ) : (
                                <>Send reset link <Send className="size-4" /></>
                            )}
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
