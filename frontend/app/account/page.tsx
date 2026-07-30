'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Globe, Shield, Award, Link2, CheckCircle2, AlertCircle, XCircle, Pencil, Loader2, Camera } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { artistApi, storageApi, ApiError } from '@/lib/api';
import YouTubeConnect from '@/components/YouTubeConnect';
import SpotifyConnect from '@/components/SpotifyConnect';
import { useEffect, useRef, useState } from 'react';

export default function AccountPage() {
    const { user, artist, refreshArtist } = useAuth();
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    const [editing, setEditing] = useState(false);
    const [stageName, setStageName] = useState('');
    const [bio, setBio] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (artist) {
            setStageName(artist.stage_name || '');
            setBio(artist.bio || '');
        }
    }, [artist, editing]);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await artistApi.updateProfile({ stage_name: stageName.trim(), bio: bio.trim() || undefined });
            await refreshArtist();
            setEditing(false);
            setNotification({ type: 'success', message: 'Profile updated.' });
        } catch (err) {
            setNotification({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to update profile.' });
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAvatar(true);
        try {
            const { file_url } = await storageApi.uploadFile(file, 'avatars');
            await artistApi.updateProfile({ profile_picture: file_url });
            await refreshArtist();
            setNotification({ type: 'success', message: 'Profile picture updated.' });
        } catch (err) {
            setNotification({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to upload picture.' });
        } finally {
            setUploadingAvatar(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    };

    // Handle OAuth callback result from URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const youtubeResult = params.get('youtube');
        const spotifyResult = params.get('spotify');

        if (youtubeResult === 'success') {
            setNotification({ type: 'success', message: 'YouTube channel connected successfully!' });
            window.history.replaceState({}, '', window.location.pathname);
        } else if (youtubeResult === 'error') {
            const msg = params.get('message');
            const readable: Record<string, string> = {
                no_channel_found: 'No YouTube channel found for that Google account.',
                token_exchange_failed: 'Failed to exchange tokens with Google. Please try again.',
                invalid_state: 'OAuth state mismatch — please try again.',
            };
            setNotification({ type: 'error', message: readable[msg || ''] || 'Failed to connect YouTube.' });
            window.history.replaceState({}, '', window.location.pathname);
        }

        if (spotifyResult === 'success') {
            setNotification({ type: 'success', message: 'Spotify account connected successfully!' });
            window.history.replaceState({}, '', window.location.pathname);
        } else if (spotifyResult === 'error') {
            const msg = params.get('message');
            const readable: Record<string, string> = {
                token_exchange_failed: 'Failed to exchange tokens with Spotify. Please try again.',
                invalid_state: 'OAuth state mismatch — please try again.',
            };
            setNotification({ type: 'error', message: readable[msg || ''] || 'Failed to connect Spotify.' });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Auto-dismiss notification after 5s
    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 5000);
        return () => clearTimeout(t);
    }, [notification]);

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-4xl mx-auto space-y-10"
        >
            {/* Toast Notification */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl max-w-sm ${
                            notification.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/10 border-red-500/20 text-red-300'
                        }`}
                    >
                        {notification.type === 'success'
                            ? <CheckCircle2 className="size-5 shrink-0" />
                            : <XCircle className="size-5 shrink-0" />
                        }
                        <p className="text-sm font-semibold">{notification.message}</p>
                        <button
                            onClick={() => setNotification(null)}
                            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
                        >
                            ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Page Title */}
            <motion.div variants={item} className="space-y-1">
                <h1 className="text-3xl font-black text-white tracking-tight">Artist Profile</h1>
                <p className="text-slate-500 font-medium">Your public metadata, account information, and platform connections.</p>
            </motion.div>

            {/* Profile Card */}
            <motion.div variants={item} className="card-premium p-10 flex flex-col items-center text-center space-y-6">
                <div className="relative">
                    <div className="size-32 rounded-full border-4 border-white/5 overflow-hidden shadow-2xl ring-2 ring-primary/20">
                        <img
                            src={artist?.profile_picture || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop"}
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {artist && (
                        <button
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={uploadingAvatar}
                            className="absolute bottom-1 right-1 size-9 rounded-full bg-primary flex items-center justify-center border-2 border-[#050505] shadow-lg text-white hover:scale-110 transition-transform disabled:opacity-60"
                            title="Change profile picture"
                        >
                            {uploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                        </button>
                    )}
                    <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>

                {editing ? (
                    <div className="w-full max-w-sm space-y-4">
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Stage Name</label>
                            <input
                                value={stageName}
                                onChange={(e) => setStageName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium focus:outline-none focus:border-primary/50"
                            />
                        </div>
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={3}
                                maxLength={500}
                                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium focus:outline-none focus:border-primary/50 resize-none"
                                placeholder="Tell listeners about yourself..."
                            />
                        </div>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setEditing(false)}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                disabled={saving || !stageName.trim()}
                                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                            >
                                {saving && <Loader2 className="size-3.5 animate-spin" />}
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="relative">
                            <div className="flex items-center gap-2 justify-center">
                                <h2 className="text-2xl font-black text-white">{artist?.stage_name || 'Artist Name'}</h2>
                                {artist && (
                                    <button
                                        onClick={() => setEditing(true)}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                                        title="Edit profile"
                                    >
                                        <Pencil className="size-3.5" />
                                    </button>
                                )}
                            </div>
                            <p className="text-slate-500 font-medium mt-1">{user?.email}</p>
                            {artist?.bio && <p className="text-slate-400 text-sm font-medium mt-3 max-w-md">{artist.bio}</p>}
                        </div>
                        <div className="flex gap-3">
                            <span className="px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase text-primary tracking-widest">
                                {user?.role || 'User'}
                            </span>
                            {user?.is_premium && (
                                <span className="px-4 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full text-[10px] font-black uppercase text-amber-400 tracking-widest">
                                    Premium
                                </span>
                            )}
                        </div>
                    </>
                )}
            </motion.div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                    { icon: Mail, label: 'Email Address', value: user?.email },
                    { icon: Globe, label: 'Stage Name', value: artist?.stage_name || 'Not set' },
                    {
                        icon: Shield, label: 'Artist Approval',
                        value: artist?.approval_status === 'approved' ? 'Approved ✓'
                            : artist?.approval_status === 'rejected' ? 'Rejected'
                            : 'Pending Admin Approval',
                    },
                    { icon: Award, label: 'Verification Badge', value: artist?.is_verified ? 'Verified Artist ✓' : 'Not Verified' },
                ].map((info) => (
                    <motion.div key={info.label} variants={item} className="card-premium p-6 space-y-3">
                        <div className="flex items-center gap-3 text-slate-500">
                            <info.icon className="size-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{info.label}</span>
                        </div>
                        <p className="text-lg font-bold text-white">{info.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* ── Connected Accounts Section ── */}
            <motion.div variants={item} className="space-y-5">
                <div className="flex items-center gap-3">
                    <Link2 className="size-5 text-primary" />
                    <div>
                        <h2 className="text-xl font-black text-white">Connected Accounts</h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Link your streaming profiles to unlock analytics and cross-platform insights.
                        </p>
                    </div>
                </div>

                {/* YouTube */}
                <motion.div
                    variants={item}
                    className="card-premium overflow-hidden"
                >
                    {/* Platform header stripe */}
                    <div className="h-1 w-full bg-gradient-to-r from-[#FF0000] via-[#ff4444] to-transparent" />
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            {/* YouTube icon */}
                            <div className="size-9 bg-[#FF0000]/10 rounded-xl flex items-center justify-center border border-[#FF0000]/20">
                                <svg className="size-5 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white tracking-wide">YouTube</h3>
                                <p className="text-xs text-slate-500">Connect your channel to display subscriber &amp; view stats</p>
                            </div>
                        </div>
                        <YouTubeConnect showStats={true} className="bg-transparent p-0 rounded-none" />
                    </div>
                </motion.div>

                {/* Spotify */}
                <motion.div
                    variants={item}
                    className="card-premium overflow-hidden"
                >
                    <div className="h-1 w-full bg-gradient-to-r from-[#1DB954] via-[#1ed760] to-transparent" />
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="size-9 bg-[#1DB954]/10 rounded-xl flex items-center justify-center border border-[#1DB954]/20">
                                <svg className="size-5 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white tracking-wide">Spotify</h3>
                                <p className="text-xs text-slate-500">Connect your Spotify account to track your listening stats</p>
                            </div>
                        </div>
                        <SpotifyConnect className="bg-transparent p-0 rounded-none" />
                    </div>
                </motion.div>

                {/* Coming Soon Platforms */}
                <motion.div variants={item} className="card-premium p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">Coming Soon</p>
                    <div className="flex flex-wrap gap-3">
                        {[
                            { name: 'TikTok', color: '#69C9D0' },
                            { name: 'SoundCloud', color: '#FF5500' },
                            { name: 'Apple Music', color: '#FA253E' },
                            { name: 'Instagram', color: '#E1306C' },
                        ].map((p) => (
                            <div
                                key={p.name}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/3 border border-white/5 opacity-50 cursor-not-allowed"
                            >
                                <span className="size-2 rounded-full" style={{ background: p.color }} />
                                <span className="text-xs font-bold text-slate-400">{p.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
