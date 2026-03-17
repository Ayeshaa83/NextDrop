'use client';

import { motion } from 'framer-motion';
import { User, Mail, Globe, Share2, Award } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function AccountPage() {
    const { user, artist } = useAuth();

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
                <h1 className="text-3xl font-black text-white tracking-tight">Artist Profile</h1>
                <p className="text-slate-500 font-medium">Your public metadata and account information.</p>
            </motion.div>

            {/* Profile Card */}
            <motion.div variants={item} className="card-premium p-10 flex flex-col items-center text-center space-y-6">
                <div className="size-32 rounded-full border-4 border-white/5 overflow-hidden shadow-2xl ring-2 ring-primary/20">
                    <img
                        src={artist?.profile_picture || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop"}
                        className="w-full h-full object-cover"
                    />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white">{artist?.stage_name || 'Artist Name'}</h2>
                    <p className="text-slate-500 font-medium">{user?.email}</p>
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
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                    { icon: Mail, label: 'Email Address', value: user?.email },
                    { icon: Globe, label: 'Stage Name', value: artist?.stage_name || 'Not set' },
                    { icon: Share2, label: 'Connected Accounts', value: 'Spotify, YouTube' },
                    { icon: Award, label: 'Verification Status', value: 'Pending' },
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
        </motion.div>
    );
}
