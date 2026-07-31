'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { artistApi, storageApi } from '@/lib/api';
import { DEFAULT_AVATAR } from '@/lib/avatar';

export default function OnboardingPage() {
    const { user, artist, isLoading, isAuthenticated, createArtistProfile, refreshArtist } = useAuth();
    const router = useRouter();

    const [stageName, setStageName] = useState('');
    const [bio, setBio] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    // Not logged in -> login. Already has a profile -> nothing to do here.
    useEffect(() => {
        if (isLoading) return;
        if (!isAuthenticated) {
            router.push('/login');
        } else if (artist) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, artist, router]);

    // Pre-fill from the name Google gave us, if any — still editable.
    useEffect(() => {
        if (user?.full_name && !stageName) {
            setStageName(user.full_name);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.full_name]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stageName.trim() || isSubmitting) return;
        setError('');
        setIsSubmitting(true);
        try {
            await createArtistProfile(stageName.trim(), bio.trim() || undefined);

            // Upload the profile picture, if one was chosen — needs the artist
            // profile to exist first, so this has to happen after the step above.
            if (avatarFile) {
                try {
                    const { file_url } = await storageApi.uploadFile(avatarFile, 'avatars');
                    await artistApi.updateProfile({ profile_picture: file_url });
                    await refreshArtist();
                } catch (avatarErr) {
                    // Don't block onboarding over a failed picture upload —
                    // they can always add one later from their profile.
                    console.error('Failed to upload profile picture:', avatarErr);
                }
            }

            router.push('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create your profile — try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || !isAuthenticated || artist) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark relative overflow-hidden p-6">
            <div className="absolute top-[-10%] left-[-10%] w-200 h-200 bg-primary/20 blur-[200px] rounded-full opacity-50 animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-150 h-150 bg-secondary/20 blur-[150px] rounded-full opacity-50 animate-pulse-slow animate-delay-300"></div>

            <div className="w-full max-w-md z-10 p-6 animate-fade-in-up">
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="size-20 flex items-center justify-center mb-4">
                        <img src="/logo.png" alt="NextDrop" className="size-full object-contain drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg mb-2">One last step.</h1>
                    <p className="text-slate-400 font-semibold text-sm">
                        {user?.email} is signed in — now set up your artist profile.
                    </p>
                </div>

                <div className="glass-card rounded-4xl p-8 border border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl bg-[#0a0a12]/60">
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold">
                            {error}
                        </div>
                    )}

                    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                        {/* Profile Picture */}
                        <div className="flex flex-col items-center gap-2 mb-1">
                            <div className="relative">
                                <div className="size-20 rounded-full overflow-hidden border-2 border-white/10 shadow-lg">
                                    <img
                                        src={avatarPreview || DEFAULT_AVATAR}
                                        alt="Profile preview"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 size-7 rounded-full bg-primary flex items-center justify-center border-2 border-[#0a0a12] shadow-lg text-white hover:scale-110 transition-transform"
                                    title="Choose profile picture"
                                >
                                    <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                                </button>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {avatarFile ? 'Looking good' : 'Add a profile picture (optional)'}
                            </span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Artist / Stage Name</label>
                            <input
                                type="text"
                                value={stageName}
                                onChange={(e) => setStageName(e.target.value)}
                                placeholder="e.g. Luna Sol"
                                required
                                autoFocus
                                className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 px-4 text-white font-semibold placeholder:text-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Bio <span className="normal-case text-slate-600">(optional)</span></label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Tell listeners about yourself..."
                                rows={3}
                                maxLength={500}
                                className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 px-4 text-white font-semibold placeholder:text-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !stageName.trim()}
                            className="w-full py-3.5 rounded-xl bg-linear-to-r from-primary to-secondary text-white font-black tracking-wide shadow-[0_10px_25px_-5px_rgba(99,102,241,0.5)] hover:scale-[1.02] hover:shadow-[0_15px_30px_-5px_rgba(99,102,241,0.6)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
                        >
                            {isSubmitting ? 'Setting up...' : 'Enter NextDrop'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
