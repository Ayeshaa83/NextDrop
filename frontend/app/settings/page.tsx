'use client';

import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Shield, Bell, CreditCard, Palette, Link2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
    const router = useRouter();

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
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
            <motion.div variants={item} className="space-y-1">
                <h1 className="text-3xl font-black text-white tracking-tight">Platform Settings</h1>
                <p className="text-slate-500 font-medium">Manage your artist experience and platform preferences.</p>
            </motion.div>

            <div className="grid gap-6">
                {/* Platform Connections — links to account page */}
                <motion.div
                    variants={item}
                    className="card-premium overflow-hidden cursor-pointer group"
                    onClick={() => router.push('/integrations')}
                >
                    <div className="h-0.5 w-full bg-gradient-to-r from-[#FF0000] via-primary to-[#1DB954] opacity-60 group-hover:opacity-100 transition-opacity" />
                    <div className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                                <Link2 className="size-6 text-slate-400 group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Platform Connections</h3>
                                <p className="text-sm text-slate-500 font-medium">Connect YouTube &amp; Spotify to unlock stats and analytics.</p>
                                <div className="flex items-center gap-2 mt-2">
                                    {/* YouTube mini badge */}
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF0000]/10 border border-[#FF0000]/20 text-[10px] font-bold text-[#FF0000]">
                                        <svg className="size-2.5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                        </svg>
                                        YouTube
                                    </span>
                                    {/* Spotify mini badge */}
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 text-[10px] font-bold text-[#1DB954]">
                                        <svg className="size-2.5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                        </svg>
                                        Spotify
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-1.5">
                            Manage
                            <ExternalLink className="size-3" />
                        </button>
                    </div>
                </motion.div>

                {/* Other settings */}
                {[
                    { icon: Palette, title: 'Appearance', desc: 'Customize your dashboard theme and layout.' },
                    { icon: Bell, title: 'Notifications', desc: 'Configure alerts for streams and sales.' },
                    { icon: Shield, title: 'Privacy & Security', desc: 'Manage your data and account protection.' },
                    { icon: CreditCard, title: 'Subscription', desc: 'Manage your premium NextDrop plan.' },
                ].map((pref) => (
                    <motion.div
                        key={pref.title}
                        variants={item}
                        className="card-premium p-6 flex items-center justify-between group cursor-pointer"
                    >
                        <div className="flex items-center gap-6">
                            <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                                <pref.icon className="size-6 text-slate-400 group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{pref.title}</h3>
                                <p className="text-sm text-slate-500 font-medium">{pref.desc}</p>
                            </div>
                        </div>
                        <button className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
                            Configure
                        </button>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
