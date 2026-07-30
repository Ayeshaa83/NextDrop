'use client';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { authApi } from '../../lib/api';

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login, isAuthenticated } = useAuth();

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

    // Surface errors bounced back from the Google OAuth callback (?google=error&message=...)
    useEffect(() => {
        if (searchParams.get('google') === 'error') {
            const message = searchParams.get('message');
            setError(message === 'inactive_account'
                ? 'That account is inactive. Contact support for help.'
                : 'Google sign-in failed. Please try again.');
        }
    }, [searchParams]);

    const handleGoogleLogin = async () => {
        if (isGoogleLoading) return;
        setIsGoogleLoading(true);
        setError('');
        try {
            await authApi.loginWithGoogle();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start Google sign-in.');
            setIsGoogleLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password, rememberMe);
            router.push('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark relative overflow-hidden">

            {/* Animated Cinematic Background */}
            <div className="absolute top-[-10%] left-[-10%] w-200 h-200 bg-primary/20 blur-[200px] rounded-full opacity-50 animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-150 h-150 bg-secondary/20 blur-[150px] rounded-full opacity-50 animate-pulse-slow animate-delay-300"></div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[50px_50px] mask-[radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)] pointer-events-none"></div>

            <div className="w-full max-w-md z-10 p-6 animate-fade-in-up">

                {/* Brand Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="size-20 flex items-center justify-center mb-4 group cursor-pointer hover:scale-110 hover:rotate-[5deg] transition-all duration-300">
                        <img src="/logo.png" alt="NextDrop" className="size-full object-contain drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg mb-2 text-center">Welcome Back.</h1>
                    <p className="text-slate-400 font-semibold text-sm text-center">Enter the studio. Your next drop awaits.</p>
                </div>

                {/* Login Form Card */}
                <div className="glass-card rounded-4xl p-8 border border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl bg-[#0a0a12]/60 relative overflow-hidden">

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form className="flex flex-col gap-5 relative z-10" onSubmit={handleSubmit}>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="artist@nextdrop.com"
                                    required
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white font-semibold placeholder:text-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 relative">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 pl-12 pr-12 text-white font-semibold placeholder:text-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility' : 'visibility_off'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-2 mt-1">
                            <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setRememberMe((v) => !v)}>
                                <div className={`size-4 rounded border transition-colors flex items-center justify-center ${rememberMe ? 'border-primary bg-primary/30' : 'border-white/20 bg-black/30 group-hover:border-primary/50'}`}>
                                    <span className={`w-2 h-2 bg-primary rounded-sm transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`}></span>
                                </div>
                                <span className="text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">Remember me</span>
                            </label>
                            <Link href="/forgot-password" className="text-xs font-bold text-secondary hover:text-white transition-colors hover:underline underline-offset-4">Forgot Password?</Link>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 rounded-xl bg-linear-to-r from-primary to-secondary text-white font-black tracking-wide shadow-[0_10px_25px_-5px_rgba(99,102,241,0.5)] hover:scale-[1.02] hover:shadow-[0_15px_30px_-5px_rgba(99,102,241,0.6)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {isLoading ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    Signing In...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Social Logins */}
                    <div className="mt-6 relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex-1 h-px bg-white/5"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Or continue with</span>
                            <div className="flex-1 h-px bg-white/5"></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={isGoogleLoading}
                                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-4 h-4" />
                                {isGoogleLoading ? 'Redirecting...' : 'Google'}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const { spotifyApi } = await import('../../lib/api');
                                        const { auth_url } = await spotifyApi.getLoginUrl();
                                        window.location.href = auth_url;
                                    } catch (err) {
                                        setError('Spotify connection requires you to be logged in first.');
                                    }
                                }}
                                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-[#1DB954]/20 hover:border-[#1DB954]/50 hover:text-[#1DB954] transition-colors flex items-center justify-center gap-2 shadow-sm group"
                            >
                                <img src="https://www.svgrepo.com/show/475684/spotify-color.svg" alt="Spotify" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" />
                                Spotify
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-center text-sm font-semibold text-slate-400 mt-8">
                    Don't have an account?{' '}
                    <Link href="/signup" className="text-primary hover:text-white font-bold transition-colors hover:underline underline-offset-4">Sign up for NextDrop</Link>
                </p>

            </div>
        </div>
    );
}

export default function Login() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}
