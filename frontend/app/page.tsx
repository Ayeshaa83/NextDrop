'use client';
import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useDashboard, formatNumber, formatCurrency } from '@/lib/hooks';
import {
  TrendingUp,
  Users,
  Play,
  Music,
  Zap,
  Globe2,
  Sparkles,
  Terminal,
  Trophy,
  ArrowRight,
  Disc,
  Activity,
  Bot,
  Plus,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function Dashboard() {
  const { user, artist, isLoading: authLoading } = useRequireAuth();
  const { data: dashboard, loading: dataLoading } = useDashboard();
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [communityChat, setCommunityChat] = useState([
      { id: 1, user: "Karan_Prod", avatar: "11", time: "2m ago", text: "That drop at 2:15 is insane! 🔥", highlight: false },
      { id: 2, user: "Riya_Vibe", avatar: "9", time: "5m ago", text: "Who's the vocalist on this? So smooth.", highlight: false },
      { id: 3, user: "Nikhil_Beats", avatar: "33", time: "Just now", text: "Def needs a heavier bassline before the hook", highlight: true }
  ]);

  const handleSendMessage = () => {
      if (!chatInput.trim() || !user) return;
      setCommunityChat(prev => [...prev, {
          id: Date.now(),
          user: user?.email?.split('@')[0] || "You",
          avatar: "50", // placeholder
          time: "Just now",
          text: chatInput.trim(),
          highlight: false
      }]);
      setChatInput("");
  };

  useEffect(() => {
    // Simulate terminal stream
    const lines = [
        "> Analyzing social sentiment across 14 networks...",
        "> [TIKTOK] Heavy rotation detected: 'Neon Nights' (+142%)",
        "> [SPOTIFY] Algorithmic playlist addition confirmed.",
        "> [YOUTUBE] Comment sentiment: 94% POSITIVE.",
        "> Global buzz threshold exceeded. Ready for push."
    ];
    let i = 0;
    const interval = setInterval(() => {
        if (i < lines.length) {
            setTerminalLines(prev => [...prev, lines[i]]);
            i++;
        } else {
            clearInterval(interval);
        }
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="size-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-slate-500 font-medium animate-pulse">Constructing platform grid...</p>
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

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-8 lg:p-12 max-w-[1700px] mx-auto space-y-8"
    >
        {/* Header */}
        <motion.header variants={item} className="flex justify-between items-end pb-4">
            <div>
                <p className="text-slate-500 font-black tracking-[0.2em] text-[10px] uppercase">Platform</p>
                <h1 className="text-4xl font-black tracking-tight text-white relative inline-flex items-center gap-3">
                    Overview
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-slate-400 align-middle">
                        <span className="size-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                        System Online
                    </span>
                </h1>
            </div>
        </motion.header>

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-min gap-6">

            {/* ============== ROW 0 (HERO & CHAT) ============== */}
            {/* Row 0.1: Hero Image (Span 8) */}
            <motion.div variants={item} className="col-span-12 xl:col-span-8 card-premium relative overflow-hidden min-h-[400px] flex flex-col justify-between group">
                {/* Background Image */}
                <img src="https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=2070&auto=format&fit=crop" alt="Hero Background" className="absolute inset-0 size-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                
                {/* Top Badges */}
                <div className="relative z-10 flex items-center justify-between p-6">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-[#ff2a5f] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(255,42,95,0.5)] animate-pulse">
                            Live
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                            <Users className="size-3 text-white" />
                            <span className="text-[10px] font-black text-white">1.2K Viewing</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Content */}
                <div className="relative z-10 p-6 lg:p-8 flex flex-col gap-4 mt-auto">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="size-10 rounded-full border-2 border-primary overflow-hidden">
                            <img src="https://i.pravatar.cc/150?img=50" className="size-full object-cover" />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm uppercase tracking-wider">Resonance</p>
                            <p className="text-emerald-400 text-[9px] uppercase tracking-widest font-black">Prime Streamer</p>
                        </div>
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight max-w-2xl drop-shadow-lg">
                            Breaking down the new Wave snippet & searching for...
                        </h2>
                        <div className="flex items-center gap-3 shrink-0">
                            <button className="flex items-center justify-center size-14 rounded-2xl bg-white text-black hover:scale-105 transition-transform shadow-xl">
                                <Play className="size-6 fill-current ml-1" />
                            </button>
                            <button className="flex items-center justify-center size-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-colors">
                                <Plus className="size-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Row 0.2: Community Buzz (Chat) - Col Span 4 */}
            <motion.div variants={item} className="col-span-12 xl:col-span-4 card-premium flex flex-col relative h-[400px]">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Community Buzz</h3>
                        <div className="size-1.5 rounded-full bg-[#ff2a5f] opacity-50" />
                    </div>
                </div>
                
                <div className="flex-1 p-5 space-y-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                    <AnimatePresence initial={false}>
                        {communityChat.map((chat) => (
                            <motion.div 
                                key={chat.id} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex gap-3"
                            >
                                <img src={`https://i.pravatar.cc/150?img=${chat.avatar}`} className="size-8 rounded-full border border-white/10 shrink-0" />
                                <div>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className={cn("text-xs font-bold", chat.highlight ? "text-primary" : "text-white")}>{chat.user}</span>
                                        <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">{chat.time}</span>
                                    </div>
                                    <div className={cn(
                                        "border rounded-2xl rounded-tl-sm p-3 inline-block",
                                        chat.highlight ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/5"
                                    )}>
                                        <p className={cn("text-sm", chat.highlight ? "text-primary-200" : "text-slate-300")}>{chat.text}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-white/5 bg-[#030303]">
                    <div className="relative flex items-center">
                        <input 
                            type="text" 
                            placeholder={user ? "Join the conversation..." : "Log in to chat..."}
                            disabled={!user}
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-full py-2.5 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button 
                            disabled={!user || !chatInput.trim()}
                            onClick={handleSendMessage}
                            className="absolute right-2 size-8 flex items-center justify-center bg-primary text-white rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                        >
                            <Send className="size-4" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* ============== ROW 1 ============== */}
            
            {/* 1. Performance Hero (Large Analytics with Global Reach) - Col Span 8 */}
            <motion.div variants={item} className="col-span-12 xl:col-span-8 card-premium p-8 flex flex-col lg:flex-row gap-8 overflow-hidden relative group">
                {/* Stats Left */}
                <div className="flex-1 flex flex-col justify-between z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-6 text-slate-400">
                            <Activity className="size-5" />
                            <h3 className="text-sm font-black uppercase tracking-widest">Global Trajectory</h3>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Streams</p>
                                <div className="text-5xl font-black text-white tracking-tighter">
                                    {formatNumber(dashboard?.total_streams || 482000)}
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                                        <Sparkles className="size-3 text-primary" />
                                        Expected Rev
                                    </p>
                                    <div className="text-2xl font-black text-primary">
                                        {formatCurrency(dashboard?.monthly_revenue_prediction || 12500)}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                                        <Sparkles className="size-3 text-emerald-400" />
                                        Avg Hit Score
                                    </p>
                                    <div className="text-2xl font-black text-white">
                                        {(dashboard?.average_hit_score || 84).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Minimalist Global Pulse Right */}
                <div className="flex-1 relative flex items-center justify-center min-h-[340px] border border-white/5 rounded-3xl bg-[#050505] overflow-hidden group/pulse">
                    {/* Very Subtle Grid */}
                    <div className="absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] bg-[size:32px_32px] opacity-30" />
                    
                    {/* The Visual Center */}
                    <div className="relative size-64 flex items-center justify-center">
                        {/* Soft Ambient Glow */}
                        <div className="absolute inset-0 bg-primary/5 rounded-full blur-[60px]" />
                        
                        {/* Elegant Minimal Globe Icon */}
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                            className="relative z-10 size-48 text-white/10"
                        >
                            <Globe2 className="size-full stroke-[0.5px]" />
                        </motion.div>

                        {/* Minimal Pulse Points */}
                        <div className="absolute top-[35%] left-[35%] z-20 flex items-center justify-center">
                            <div className="size-1.5 rounded-full bg-emerald-400" />
                            <div className="absolute size-4 rounded-full border border-emerald-400/30 animate-ping" />
                        </div>
                        <div className="absolute top-[50%] right-[30%] z-20 flex items-center justify-center">
                            <div className="size-1.5 rounded-full bg-primary" />
                            <div className="absolute size-4 rounded-full border border-primary/30 animate-ping delay-700" />
                        </div>
                        <div className="absolute bottom-[35%] left-[45%] z-20 flex items-center justify-center">
                            <div className="size-1.5 rounded-full bg-white" />
                            <div className="absolute size-4 rounded-full border border-white/20 animate-ping delay-300" />
                        </div>
                    </div>

                    {/* Minimal Data HUD (Bottom-weighted) */}
                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Top Location</p>
                                <div className="flex items-center gap-2">
                                    <div className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[11px] font-bold text-white">Mumbai, IN</span>
                                </div>
                            </div>
                            <div className="h-6 w-px bg-white/10" />
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Listeners</p>
                                <span className="text-[11px] font-bold text-white">12.4K</span>
                            </div>
                        </div>

                        <div className="text-right">
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Trajectory</p>
                             <span className="text-[11px] font-black text-emerald-400">+24.2%</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 2. AI Network Insights (Chatter) - Col Span 4 */}
            <motion.div variants={item} className="col-span-12 xl:col-span-4 card-premium flex flex-col relative overflow-hidden h-[360px] xl:h-auto">
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-emerald-400" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Network Intel</h3>
                    </div>
                    <Bot className="size-4 text-slate-500" />
                </div>
                
                <div className="flex-1 p-5 space-y-4 overflow-y-auto custom-scrollbar flex flex-col gap-2 relative z-10">
                    <div className="bg-white/5 border border-white/5 rounded-r-xl rounded-bl-xl p-3 max-w-[90%]">
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                            <strong className="text-white">Trend Alert:</strong> Phonk beats with Indian classical samples are surging in tier-1 playlists.
                        </p>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-l-xl rounded-br-xl p-3 max-w-[90%] self-end">
                        <p className="text-xs text-primary-200 leading-relaxed font-medium">
                            Your track <strong className="text-white">"Neon Nights"</strong> aligns perfectly. Pushing to Discovery Queue.
                        </p>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-r-xl rounded-bl-xl p-3 max-w-[90%] flex items-center gap-3 mt-auto">
                        <div className="size-8 rounded-lg bg-[#050505] flex items-center justify-center shrink-0">
                            <TrendingUp className="size-4 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Action Suggested</p>
                            <p className="text-xs text-white font-medium">Cut a 15s snippet for TikTok.</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ============== ROW 2 ============== */}

            {/* 3. Upcoming Releases (Col Span 4) */}
            <motion.div variants={item} className="col-span-12 lg:col-span-6 xl:col-span-4 card-premium p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Release Manager</h3>
                    <Link href="/upload" className="flex items-center justify-center size-8 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                        <Plus className="size-4 text-white" />
                    </Link>
                </div>
                <div className="space-y-3 flex-1">
                    {[
                        { title: 'Midnight Drive', status: 'Ready to Distribute', style: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
                        { title: 'Echoes', status: 'AI Analyzing...', style: 'text-primary bg-primary/10 border-primary/20 animate-pulse' },
                        { title: 'Voltage (Remix)', status: 'Draft', style: 'text-slate-400 bg-white/5 border-white/10' },
                    ].map(r => (
                        <div key={r.title} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-[#050505] hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-3">
                                <Disc className="size-8 text-slate-600 group-hover:text-white transition-colors" />
                                <h4 className="text-sm font-bold text-white tracking-tight">{r.title}</h4>
                            </div>
                            <span className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border", r.style)}>
                                {r.status}
                            </span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* 4. Community Leaderboard (Mini Podium) - Col Span 4 */}
            <motion.div variants={item} className="col-span-12 lg:col-span-6 xl:col-span-4 card-premium p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Trophy className="size-4" /> Podium
                    </h3>
                    <Link href="/leaderboard" className="text-[10px] font-black text-primary uppercase hover:text-white transition-colors">Full Rankings</Link>
                </div>
                
                {/* Mini Podium Graphic */}
                <div className="flex-1 flex items-end justify-center gap-2 pb-6">
                    {/* Rank 2 */}
                    <div className="flex flex-col items-center w-24">
                        <div className="size-10 rounded-full bg-slate-800 border-2 border-slate-600 overflow-hidden mb-2 z-10 shadow-lg">
                            <img src="https://i.pravatar.cc/150?img=11" className="size-full object-cover" />
                        </div>
                        <div className="w-full bg-slate-800/50 border border-slate-700/50 rounded-t-xl h-20 flex justify-center pt-2 backdrop-blur-sm">
                            <span className="text-slate-400 font-black text-lg">2</span>
                        </div>
                    </div>
                    {/* Rank 1 */}
                    <div className="flex flex-col items-center w-28 -mx-2">
                        <div className="size-14 rounded-full bg-primary border-4 border-[#050505] overflow-hidden mb-2 z-20 shadow-[0_0_20px_#6366f1]">
                            <img src="https://i.pravatar.cc/150?img=33" className="size-full object-cover" />
                        </div>
                        <div className="w-full bg-primary/20 border border-primary/50 border-b-0 rounded-t-xl h-32 flex justify-center pt-2 backdrop-blur-md relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
                            <span className="text-white font-black text-2xl relative z-10">1</span>
                        </div>
                    </div>
                    {/* Rank 3 */}
                    <div className="flex flex-col items-center w-24">
                        <div className="size-10 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden mb-2 z-10 shadow-lg">
                            <img src="https://i.pravatar.cc/150?img=12" className="size-full object-cover" />
                        </div>
                        <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-t-xl h-16 flex justify-center pt-2 backdrop-blur-sm">
                            <span className="text-slate-500 font-black text-lg">3</span>
                        </div>
                    </div>
                </div>

                {/* Sticky Footer for User */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full overflow-hidden">
                            <img src={artist?.profile_picture || "https://i.pravatar.cc/150"} alt="User" className="size-full object-cover" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Your Rank</p>
                            <p className="text-sm text-white font-bold tracking-tight">#142 <span className="text-emerald-400 ml-1 text-xs">▲ 12</span></p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 5. Sentiment Feed (Terminal) - Col Span 4 */}
            <motion.div variants={item} className="col-span-12 xl:col-span-4 card-premium overflow-hidden flex flex-col bg-[#020202] h-[360px]">
                <div className="p-3 border-b border-white/5 bg-[#050505] flex items-center gap-2">
                    <Terminal className="size-4 text-slate-500" />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">sys_sentiment.log</span>
                    <Sparkles className="size-3 text-primary ml-auto" />
                </div>
                <div className="flex-1 p-5 font-mono text-xs leading-relaxed space-y-2 overflow-y-auto">
                    {terminalLines.map((line, i) => (
                        <div key={i} className="text-emerald-400/80 break-words drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                            {line}
                        </div>
                    ))}
                    <div className="animate-pulse text-emerald-400/50">_</div>
                </div>
            </motion.div>

            {/* ============== ROW 3 ============== */}

            {/* 6. Jam Jar Feed Snippet - Col Span 12 */}
            <motion.div variants={item} className="col-span-12 card-premium p-6 lg:p-8 flex flex-col lg:flex-row items-center gap-8 group">
                <div className="lg:w-1/3 space-y-3 shrink-0">
                    <div className="flex items-center gap-2 text-primary">
                        <Users className="size-5" />
                        <h3 className="text-lg font-black tracking-tight text-white uppercase">Jam Jar Feed</h3>
                    </div>
                    <p className="text-sm font-medium text-slate-400">
                        Real-time collab snippets matching your AI profile score.
                    </p>
                    <Link href="/jamjar" className="inline-flex mt-2 items-center gap-2 px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors border border-white/10">
                        Enter Jar <ArrowRight className="size-3" />
                    </Link>
                </div>

                {/* Horizontal feed tape */}
                <div className="flex-1 w-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg-card to-transparent z-10" />
                    <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg-card to-transparent z-10" />
                    
                    <div className="flex w-fit gap-4 py-2 opacity-50 group-hover:opacity-100 transition-opacity duration-700">
                       {[1, 2, 3].map(i => (
                           <div key={i} className="w-[300px] shrink-0 bg-[#050505] border border-white/5 rounded-2xl p-4 flex gap-4 hover:border-white/20 transition-colors">
                               <button className="size-10 shrink-0 rounded-full bg-white text-black flex items-center justify-center shadow-lg cursor-pointer">
                                   <Play className="size-4 fill-current ml-0.5" />
                               </button>
                               <div className="overflow-hidden">
                                   <h4 className="text-sm font-bold text-white truncate">Searching for a Topline</h4>
                                   <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest truncate mt-1">@Producer_K</p>
                                   <div className="mt-2 text-[9px] font-black text-secondary uppercase px-2 py-0.5 border border-secondary/20 bg-secondary/10 rounded-md inline-block">Open Verse</div>
                               </div>
                           </div>
                       ))}
                    </div>
                </div>
            </motion.div>

        </div>
    </motion.div>
  );
}