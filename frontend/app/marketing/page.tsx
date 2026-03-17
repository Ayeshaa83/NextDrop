'use client';

import { useRequireAuth } from '@/lib/auth';
import {
    Sparkles,
    Video,
    Image as ImageIcon,
    MessageSquare,
    TrendingUp,
    Zap,
    Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function MarketingSuite() {
    const { user, artist, isLoading: authLoading } = useRequireAuth();
    const [isGeneratingReel, setIsGeneratingReel] = useState(false);
    const [isGeneratingCanvas, setIsGeneratingCanvas] = useState(false);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="size-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-slate-500 font-medium animate-pulse">Initializing Growth Engine...</p>
                </div>
            </div>
        );
    }

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

    const handleGenerateReel = () => {
        setIsGeneratingReel(true);
        setTimeout(() => setIsGeneratingReel(false), 2000);
    };

    const handleGenerateCanvas = () => {
        setIsGeneratingCanvas(true);
        setTimeout(() => setIsGeneratingCanvas(false), 2500);
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="p-8 lg:p-12 max-w-[1400px] mx-auto space-y-12"
        >
            <motion.header variants={item} className="flex justify-between items-end">
                <div className="space-y-1">
                    <p className="text-emerald-400 font-black tracking-[0.2em] text-[10px] uppercase">Growth Engine</p>
                    <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-3">
                        Marketing Suite
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] uppercase tracking-widest text-emerald-400 align-middle shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                            <Sparkles className="size-3" />
                            AI Powered
                        </span>
                    </h1>
                </div>
            </motion.header>

            {/* Smart Navigation Tabs */}
            <motion.div variants={item} className="flex items-center gap-2 bg-[#050505] p-1.5 rounded-2xl border border-white/5 w-fit">
                {["Assets Generator", "Campaigns", "Social Analytics"].map((tab, i) => (
                    <button
                        key={tab}
                        className={cn(
                            "px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                            i === 0 ? "bg-white/10 text-white shadow-lg backdrop-blur-md" : "text-slate-500 hover:text-white"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </motion.div>

            {/* Assets Generator Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* IG Reel Script Generator */}
                <motion.div variants={item} className="card-premium p-8 group relative overflow-hidden flex flex-col h-[400px]">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Video className="size-40" />
                    </div>
                    
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="size-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.1)]">
                            <Video className="size-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">IG Reel Script</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Short Form Virality</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm mb-auto relative z-10">
                        Let AI write a highly engaging, trend-optimized 15-second hook specifically tailored to your song's hit potential and demographic.
                    </p>

                    <div className="w-full bg-[#050505] border border-white/5 rounded-2xl p-4 mb-6 relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Target Track</span>
                        </div>
                        <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50 appearance-none font-bold">
                            <option className="bg-[#050505]">Midnight Drive (Hit Potential: 85%)</option>
                            <option className="bg-[#050505]">Neon Nights (Hit Potential: 92%)</option>
                            <option className="bg-[#050505]">Echoes (Analyzing...)</option>
                        </select>
                    </div>

                    <button 
                        onClick={handleGenerateReel}
                        disabled={isGeneratingReel}
                        className="w-full relative z-10 py-5 bg-white text-black font-black uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-xl disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 group/btn"
                    >
                        {isGeneratingReel ? (
                            <>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                    <Sparkles className="size-5 text-rose-500" />
                                </motion.div>
                                Writing hook...
                            </>
                        ) : (
                            <>
                                <Sparkles className="size-5 text-rose-500 group-hover/btn:animate-pulse" />
                                Generate Script
                            </>
                        )}
                    </button>
                </motion.div>

                {/* Spotify Canvas Generator */}
                <motion.div variants={item} className="card-premium p-8 group relative overflow-hidden flex flex-col h-[400px]">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ImageIcon className="size-40" />
                    </div>
                    
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                            <ImageIcon className="size-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Spotify Canvas</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Visual Immersion</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm mb-auto relative z-10">
                        Generate a 8-second seamless looping visualizer based on your track's AI-detected mood, genre, and tempo.
                    </p>

                    <div className="w-full bg-[#050505] border border-white/5 rounded-2xl p-4 mb-6 relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Target Track</span>
                        </div>
                        <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 appearance-none font-bold">
                            <option className="bg-[#050505]">Midnight Drive (Mood: Energetic)</option>
                            <option className="bg-[#050505]">Neon Nights (Mood: Chill)</option>
                        </select>
                    </div>

                    <button 
                        onClick={handleGenerateCanvas}
                        disabled={isGeneratingCanvas}
                        className="w-full relative z-10 py-5 bg-white text-black font-black uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-xl disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 group/btn"
                    >
                        {isGeneratingCanvas ? (
                            <>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                    <Sparkles className="size-5 text-emerald-500" />
                                </motion.div>
                                Rendering visualizer...
                            </>
                        ) : (
                            <>
                                <Sparkles className="size-5 text-emerald-500 group-hover/btn:animate-pulse" />
                                Create Canvas
                            </>
                        )}
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}
