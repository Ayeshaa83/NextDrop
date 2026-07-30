'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { authApi } from '../../lib/api';

export default function Signup() {
    const [stageName, setStageName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const router = useRouter();
    const { signup, createArtistProfile, isAuthenticated } = useAuth();

    const handleGoogleSignup = async () => {
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

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!agreed) {
            setError('Please agree to the Terms of Service and Privacy Policy');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            // Create user account and login
            await signup(email, password);

            // Create artist profile with stage name
            if (stageName) {
                await createArtistProfile(stageName);
            }

            router.push('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Signup failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark relative overflow-hidden py-10 overflow-y-auto">

            {/* Animated Cinematic Background */}
            <div className="absolute top-[20%] right-[-10%] w-225 h-225 bg-secondary/20 blur-[200px] rounded-full opacity-50 animate-pulse-slow"></div>
            <div className="absolute bottom-[10%] left-[-20%] w-175 h-175 bg-primary/20 blur-[150px] rounded-full opacity-50 animate-pulse-slow animate-delay-300"></div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[50px_50px] mask-[radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)] pointer-events-none"></div>

            <div className="w-full max-w-lg z-10 p-6 animate-fade-in-up mt-10">

                {/* Brand Header */}
                <div className="flex flex-col items-center mb-7">
                    <div className="size-20 flex items-center justify-center mb-4 group cursor-pointer hover:scale-110 hover:rotate-[-5deg] transition-all duration-300">
                        <img src="/logo.png" alt="NextDrop" className="size-full object-contain drop-shadow-[0_0_30px_rgba(0,242,254,0.4)]" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg mb-2 text-center">Join the Movement.</h1>
                    <p className="text-slate-400 font-semibold text-sm text-center">Create your NextDrop account to start collaborating.</p>
                </div>

                {/* Signup Form Card */}
                <div className="glass-card rounded-4xl p-8 border border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl bg-[#0a0a12]/70 relative overflow-hidden">

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold">
                            {error}
                        </div>
                    )}

                    <form className="flex flex-col gap-6 relative z-10" onSubmit={handleSubmit}>

                        {/* Role Toggle */}
                        <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/5 relative z-10">
                            <button type="button" className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-sm shadow-sm transition-all border border-white/10 flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">mic_external_on</span>
                                Artist
                            </button>
                            <button type="button" className="flex-1 py-2.5 rounded-xl text-slate-400 font-bold text-sm hover:text-white transition-all flex items-center justify-center gap-2 hover:bg-white/5 border border-transparent">
                                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                                Admin
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2 relative">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Artist / Alias</label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-secondary transition-colors text-[20px]">person</span>
                                    <input
                                        type="text"
                                        value={stageName}
                                        onChange={(e) => setStageName(e.target.value)}
                                        placeholder="e.g. Luna Sol"
                                        required
                                        className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-secondary/50 focus:ring-1 focus:ring-secondary/50 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 relative">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-secondary transition-colors text-[20px]">mail</span>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="artist@nextdrop.com"
                                        required
                                        className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-secondary/50 focus:ring-1 focus:ring-secondary/50 transition-all shadow-inner"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 relative">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-secondary transition-colors text-[20px]">lock</span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-12 text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-secondary/50 focus:ring-1 focus:ring-secondary/50 transition-all shadow-inner"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility' : 'visibility_off'}</span>
                                </button>
                            </div>
                        </div>

                        <label className="flex items-start gap-3 cursor-pointer group mt-2" onClick={() => setAgreed(!agreed)}>
                            <div className={`size-5 shrink-0 rounded border ${agreed ? 'border-secondary bg-secondary/20' : 'border-white/20 bg-black/30'} group-hover:border-secondary/50 transition-colors flex items-center justify-center mt-0.5`}>
                                {agreed && <span className="material-symbols-outlined text-secondary text-[14px]">check</span>}
                            </div>
                            <span className="text-xs font-semibold text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                                I agree to the <a href="#" className="text-secondary hover:text-white hover:underline transition-colors">Terms of Service</a> and <a href="#" className="text-secondary hover:text-white hover:underline transition-colors">Privacy Policy</a>.
                            </span>
                        </label>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 mt-2 rounded-xl bg-linear-to-r from-secondary to-primary text-[#0a0a12] font-black tracking-wide shadow-[0_10px_30px_-5px_rgba(0,242,254,0.4)] hover:scale-[1.02] hover:shadow-[0_15px_40px_-5px_rgba(0,242,254,0.6)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {isLoading ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    Creating Account...
                                </>
                            ) : (
                                <>
                                    Create Account
                                    <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Social Logins */}
                    <div className="mt-8 relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex-1 h-px bg-white/5"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sign up with provider</span>
                            <div className="flex-1 h-px bg-white/5"></div>
                        </div>

                        <div className="flex justify-center gap-4">
                            <button
                                type="button"
                                onClick={handleGoogleSignup}
                                disabled={isGoogleLoading}
                                className="size-12 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const { spotifyApi } = await import('../../lib/api');
                                        const { auth_url } = await spotifyApi.getLoginUrl();
                                        window.location.href = auth_url;
                                    } catch (err) {
                                        setError('Spotify connection requires an active session. Please sign up with email first.');
                                    }
                                }}
                                className="size-12 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-[#1DB954]/20 hover:border-[#1DB954]/50 transition-colors flex items-center justify-center shadow-sm group"
                            >
                                <img src="https://www.svgrepo.com/show/475684/spotify-color.svg" alt="Spotify" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-center text-sm font-semibold text-slate-400 mt-8 mb-10">
                    Already have an account?{' '}
                    <Link href="/login" className="text-secondary hover:text-white font-bold transition-colors hover:underline underline-offset-4">Sign in</Link>
                </p>

            </div>
        </div>
    );
}
