'use client';

import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Shield, Bell, CreditCard, Palette } from 'lucide-react';

export default function SettingsPage() {
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
