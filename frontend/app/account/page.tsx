'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Mail, Globe, Shield, Award, Link2, CheckCircle2, XCircle, Pencil, Loader2, Camera, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { artistApi, storageApi, ApiError } from '@/lib/api';
import { DEFAULT_AVATAR } from '@/lib/avatar';
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
                            src={artist?.profile_picture || DEFAULT_AVATAR}
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

            {/* Platform connections now live entirely on /integrations — this just links out */}
            <motion.div variants={item}>
                <Link
                    href="/integrations"
                    className="card-premium overflow-hidden flex items-center justify-between p-6 group hover:border-primary/30 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Link2 className="size-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Platform Connections</h3>
                            <p className="text-sm text-slate-500 font-medium">Manage YouTube, Spotify, and other connected platforms.</p>
                        </div>
                    </div>
                    <ArrowRight className="size-4 text-slate-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
            </motion.div>
        </motion.div>
    );
}
