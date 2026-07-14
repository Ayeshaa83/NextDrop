'use client';
import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useDashboard, formatNumber, formatCurrency } from '@/lib/hooks';
import {
  TrendingUp,
  Users,
  Play,
  Globe2,
  Sparkles,
  Terminal,
  Trophy,
  ArrowRight,
  Disc,
  Activity,
  Plus,
  Send,
  Music,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { tracksApi, socialApi, feedApi, Track, LeaderboardEntry, SocialPost } from '@/lib/api';

// ── Framer variants ─────────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function trackStatusStyle(status: string) {
  if (status === 'completed') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  if (status === 'processing' || status === 'pending')
    return 'text-primary bg-primary/10 border-primary/20 animate-pulse';
  return 'text-slate-400 bg-white/5 border-white/10';
}
function trackStatusLabel(status: string) {
  if (status === 'completed') return 'Ready to Distribute';
  if (status === 'processing') return 'AI Analyzing…';
  if (status === 'pending') return 'Queued';
  return 'Draft';
}
function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Terminal boot lines ──────────────────────────────────────────────────────
const BOOT_LINES = [
  '> Initialising NextDrop analytics engine…',
  '> Connecting to platform data streams…',
  '> Audio fingerprint index loaded.',
  '> Hit-score model warm — ready.',
  '> Connect Instagram to enable Viral Velocity™.',
];

export default function Dashboard() {
  const { user, artist, isLoading: authLoading } = useRequireAuth();

  // Admins get the clean admin panel, not the artist dashboard
  useEffect(() => {
    if (!authLoading && user?.role === 'admin') {
      window.location.href = '/admin';
    }
  }, [authLoading, user?.role]);
  const { data: dashboard, loading: dataLoading } = useDashboard();

  // Real data states
  const [myTracks, setMyTracks] = useState<Track[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [feedPosts, setFeedPosts] = useState<SocialPost[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [localChat, setLocalChat] = useState<{ id: number; author: string; text: string; time: string }[]>([]);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  // Fetch real tracks
  useEffect(() => {
    tracksApi.getMyTracks(0, 5)
      .then(r => setMyTracks(r.items))
      .catch(() => {});
  }, []);

  // Fetch leaderboard top 3
  useEffect(() => {
    socialApi.getLeaderboard(undefined, 0, 3)
      .then(r => setLeaderboard(r.items))
      .catch(() => {});
  }, []);

  // Fetch open-verse posts for Jam Jar preview
  useEffect(() => {
    feedApi.getFeed(0, 4, 'open_verse')
      .then(r => setFeedPosts(r.items))
      .catch(() => {});
  }, []);

  // Terminal boot sequence
  useEffect(() => {
    let i = 0;
    setTerminalLines([]);
    const iv = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setTerminalLines(prev => [...prev, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(iv);
      }
    }, 1100);
    return () => clearInterval(iv);
  }, []);

  const handleSendMessage = () => {
    if (!chatInput.trim() || !user) return;
    setLocalChat(prev => [
      ...prev,
      {
        id: Date.now(),
        author: user.email.split('@')[0],
        text: chatInput.trim(),
        time: 'Just now',
      },
    ]);
    setChatInput('');
  };

  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="size-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-slate-500 font-medium animate-pulse">Constructing platform grid…</p>
        </div>
      </div>
    );
  }

  // ── Leaderboard podium slots ───────────────────────────────────────────────
  const podium = [
    leaderboard[1] ?? null, // rank 2 (left)
    leaderboard[0] ?? null, // rank 1 (center)
    leaderboard[2] ?? null, // rank 3 (right)
  ];

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

        {/* ═══ ROW 0: HERO + COMMUNITY BUZZ ═══════════════════════════════ */}

        {/* Hero card */}
        <motion.div variants={item} className="col-span-12 xl:col-span-8 card-premium relative overflow-hidden min-h-[400px] flex flex-col justify-between group">
          <img
            src="https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=2070&auto=format&fit=crop"
            alt="Hero Background"
            className="absolute inset-0 size-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <div className="relative z-10 flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-[#ff2a5f] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(255,42,95,0.5)] animate-pulse">
                Live
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                <Users className="size-3 text-white" />
                <span className="text-[10px] font-black text-white">
                  {formatNumber(dashboard?.total_streams ?? 0)} Total Streams
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 p-6 lg:p-8 flex flex-col gap-4 mt-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-full border-2 border-primary overflow-hidden bg-slate-800 flex items-center justify-center">
                {artist?.profile_picture
                  ? <img src={artist.profile_picture} className="size-full object-cover" />
                  : <Music className="size-4 text-slate-400" />
                }
              </div>
              <div>
                <p className="text-white font-black text-sm uppercase tracking-wider">
                  {artist?.stage_name ?? 'Your Artist Profile'}
                </p>
                <p className="text-emerald-400 text-[9px] uppercase tracking-widest font-black">
                  NextDrop Artist
                </p>
              </div>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight max-w-2xl drop-shadow-lg">
                {myTracks[0]?.title
                  ? `Now tracking: ${myTracks[0].title}`
                  : 'Upload your first track to get started'}
              </h2>
              <div className="flex items-center gap-3 shrink-0">
                <Link href="/upload">
                  <button className="flex items-center justify-center size-14 rounded-2xl bg-white text-black hover:scale-105 transition-transform shadow-xl">
                    <Plus className="size-6" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Community Buzz — real feed posts as chat */}
        <motion.div variants={item} className="col-span-12 xl:col-span-4 card-premium flex flex-col relative h-[400px]">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Community Buzz</h3>
              <div className="size-1.5 rounded-full bg-[#ff2a5f] opacity-50" />
            </div>
            <Link href="/jamjar" className="text-[10px] font-black text-primary uppercase hover:text-white transition-colors">
              View All
            </Link>
          </div>

          <div className="flex-1 p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {/* Real feed posts */}
              {feedPosts.map(post => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-3"
                >
                  <div className="size-8 rounded-full bg-slate-800 border border-white/10 shrink-0 flex items-center justify-center overflow-hidden">
                    {post.artist.profile_picture
                      ? <img src={post.artist.profile_picture} className="size-full object-cover" />
                      : <span className="text-[10px] font-black text-slate-400">
                          {post.artist.stage_name.charAt(0)}
                        </span>
                    }
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-white">{post.artist.stage_name}</span>
                      <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                        {timeAgo(post.created_at)}
                      </span>
                    </div>
                    <div className="border border-white/5 bg-white/5 rounded-2xl rounded-tl-sm p-3 inline-block">
                      <p className="text-sm text-slate-300">{post.content}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {/* Local typed messages */}
              {localChat.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-3 justify-end"
                >
                  <div>
                    <div className="flex items-baseline gap-2 mb-1 justify-end">
                      <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">{msg.time}</span>
                      <span className="text-xs font-bold text-primary">{msg.author}</span>
                    </div>
                    <div className="border border-primary/20 bg-primary/10 rounded-2xl rounded-tr-sm p-3 inline-block">
                      <p className="text-sm text-primary-200">{msg.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {feedPosts.length === 0 && localChat.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                  <Users className="size-8 text-slate-700 mb-3" />
                  <p className="text-sm text-slate-500 font-medium">No posts yet</p>
                  <p className="text-xs text-slate-600 mt-1">Be the first to share in the Jam Jar</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 border-t border-white/5 bg-[#030303]">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder={user ? 'Join the conversation…' : 'Log in to chat…'}
                disabled={!user}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
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

        {/* ═══ ROW 1: GLOBAL TRAJECTORY + IG AI ══════════════════════════ */}

        {/* Global Trajectory */}
        <motion.div variants={item} className="col-span-12 xl:col-span-8 card-premium p-8 flex flex-col lg:flex-row gap-8 overflow-hidden relative group">
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
                    {formatNumber(dashboard?.total_streams ?? 0)}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                      <Sparkles className="size-3 text-primary" />
                      Expected Rev
                    </p>
                    <div className="text-2xl font-black text-primary">
                      {formatCurrency(dashboard?.monthly_revenue_prediction ?? 0)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                      <Sparkles className="size-3 text-emerald-400" />
                      Avg Hit Score
                    </p>
                    <div className="text-2xl font-black text-white">
                      {dashboard?.average_hit_score != null
                        ? `${dashboard.average_hit_score.toFixed(0)}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Globe visual */}
          <div className="flex-1 relative flex items-center justify-center min-h-[340px] border border-white/5 rounded-3xl bg-[#050505] overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] bg-[size:32px_32px] opacity-30" />
            <div className="relative size-64 flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/5 rounded-full blur-[60px]" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                className="relative z-10 size-48 text-white/10"
              >
                <Globe2 className="size-full stroke-[0.5px]" />
              </motion.div>
              <div className="absolute top-[35%] left-[35%] z-20 flex items-center justify-center">
                <div className="size-1.5 rounded-full bg-emerald-400" />
                <div className="absolute size-4 rounded-full border border-emerald-400/30 animate-ping" />
              </div>
              <div className="absolute top-[50%] right-[30%] z-20 flex items-center justify-center">
                <div className="size-1.5 rounded-full bg-primary" />
                <div className="absolute size-4 rounded-full border border-primary/30 animate-ping delay-700" />
              </div>
            </div>
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Tracks</p>
                  <span className="text-[11px] font-bold text-white">{myTracks.length} uploaded</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Saves</p>
                <span className="text-[11px] font-black text-emerald-400">{formatNumber(dashboard?.total_saves ?? 0)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* IG Marketing AI — Connect prompt */}
        <motion.div variants={item} className="col-span-12 xl:col-span-4 card-premium flex flex-col relative overflow-hidden h-[360px] xl:h-auto">
          <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#ff2a5f]" />
              <h3 className="text-sm font-black uppercase tracking-widest text-white">IG Marketing AI</h3>
            </div>
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase px-2 py-1 rounded-full bg-white/5 border border-white/5">
              Coming Soon
            </span>
          </div>
          <div className="flex-1 p-5 flex flex-col justify-between gap-4">
            <div className="bg-white/5 border border-white/5 rounded-r-xl rounded-bl-xl p-4">
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                <strong className="text-white">Viral Velocity™</strong> will analyse your Instagram Reels
                engagement to surface regional growth trends and AI-generated campaign strategies.
              </p>
            </div>
            <div className="bg-[#ff2a5f]/10 border border-[#ff2a5f]/20 rounded-l-xl rounded-br-xl p-4">
              <p className="text-xs text-[#ff2a5f] leading-relaxed font-medium">
                Connect your Instagram account from the <strong>Integrations</strong> hub to unlock
                real-time velocity scoring for your tracks.
              </p>
            </div>
            <Link href="/integrations">
              <button className="w-full uppercase text-[10px] font-black tracking-widest bg-white text-black py-2.5 rounded-lg hover:scale-[1.02] transition-transform">
                Connect Platforms →
              </button>
            </Link>
          </div>
        </motion.div>

        {/* ═══ ROW 2: RELEASE MANAGER + LEADERBOARD + TERMINAL ══════════ */}

        {/* Release Manager — real tracks */}
        <motion.div variants={item} className="col-span-12 lg:col-span-6 xl:col-span-4 card-premium p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Release Manager</h3>
            <Link href="/upload" className="flex items-center justify-center size-8 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
              <Plus className="size-4 text-white" />
            </Link>
          </div>
          <div className="space-y-3 flex-1">
            {myTracks.length > 0
              ? myTracks.slice(0, 4).map(track => (
                  <Link
                    key={track.id}
                    href={`/tracks/${track.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-[#050505] hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Disc className="size-8 text-slate-600 group-hover:text-white transition-colors" />
                      <h4 className="text-sm font-bold text-white tracking-tight truncate max-w-[140px]">{track.title}</h4>
                    </div>
                    <span className={cn('text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border', trackStatusStyle(track.processing_status ?? 'draft'))}>
                      {trackStatusLabel(track.processing_status ?? 'draft')}
                    </span>
                  </Link>
                ))
              : (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                  <Music className="size-8 text-slate-700 mb-3" />
                  <p className="text-sm text-slate-500">No tracks yet</p>
                  <Link href="/upload" className="mt-3 text-xs font-black text-primary uppercase tracking-widest hover:text-white transition-colors">
                    Upload your first track →
                  </Link>
                </div>
              )
            }
          </div>
        </motion.div>

        {/* Podium — real leaderboard top 3 */}
        <motion.div variants={item} className="col-span-12 lg:col-span-6 xl:col-span-4 card-premium p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Trophy className="size-4" /> Podium
            </h3>
            <Link href="/leaderboard" className="text-[10px] font-black text-primary uppercase hover:text-white transition-colors">
              Full Rankings
            </Link>
          </div>
          <div className="flex-1 flex items-end justify-center gap-2 pb-6">
            {/* Rank 2 */}
            <div className="flex flex-col items-center w-24">
              <div className="size-10 rounded-full bg-slate-800 border-2 border-slate-600 overflow-hidden mb-2 z-10 shadow-lg flex items-center justify-center">
                {podium[0]?.profile_picture
                  ? <img src={podium[0].profile_picture} className="size-full object-cover" />
                  : <span className="text-xs font-black text-slate-400">{podium[0]?.stage_name?.charAt(0) ?? '2'}</span>
                }
              </div>
              <div className="w-full bg-slate-800/50 border border-slate-700/50 rounded-t-xl h-20 flex flex-col items-center pt-2 backdrop-blur-sm">
                <span className="text-slate-400 font-black text-lg">2</span>
                {podium[0] && <span className="text-[8px] text-slate-500 font-black uppercase truncate px-2">{podium[0].stage_name}</span>}
              </div>
            </div>
            {/* Rank 1 */}
            <div className="flex flex-col items-center w-28 -mx-2">
              <div className="size-14 rounded-full bg-primary border-4 border-[#050505] overflow-hidden mb-2 z-20 shadow-[0_0_20px_#6366f1] flex items-center justify-center">
                {podium[1]?.profile_picture
                  ? <img src={podium[1].profile_picture} className="size-full object-cover" />
                  : <span className="text-base font-black text-white">{podium[1]?.stage_name?.charAt(0) ?? '1'}</span>
                }
              </div>
              <div className="w-full bg-primary/20 border border-primary/50 border-b-0 rounded-t-xl h-32 flex flex-col items-center pt-2 backdrop-blur-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
                <span className="text-white font-black text-2xl relative z-10">1</span>
                {podium[1] && <span className="text-[8px] text-primary-300 font-black uppercase truncate px-2 relative z-10">{podium[1].stage_name}</span>}
              </div>
            </div>
            {/* Rank 3 */}
            <div className="flex flex-col items-center w-24">
              <div className="size-10 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden mb-2 z-10 shadow-lg flex items-center justify-center">
                {podium[2]?.profile_picture
                  ? <img src={podium[2].profile_picture} className="size-full object-cover" />
                  : <span className="text-xs font-black text-slate-500">{podium[2]?.stage_name?.charAt(0) ?? '3'}</span>
                }
              </div>
              <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-t-xl h-16 flex flex-col items-center pt-2 backdrop-blur-sm">
                <span className="text-slate-500 font-black text-lg">3</span>
                {podium[2] && <span className="text-[8px] text-slate-600 font-black uppercase truncate px-2">{podium[2].stage_name}</span>}
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                {artist?.profile_picture
                  ? <img src={artist.profile_picture} alt="You" className="size-full object-cover" />
                  : <span className="text-[10px] font-black text-slate-400">{artist?.stage_name?.charAt(0) ?? 'Y'}</span>
                }
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Your Rank</p>
                <p className="text-sm text-white font-bold tracking-tight">
                  {artist?.stage_name ?? 'Join to rank'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Terminal — boot sequence */}
        <motion.div variants={item} className="col-span-12 xl:col-span-4 card-premium overflow-hidden flex flex-col bg-[#020202] h-[360px]">
          <div className="p-3 border-b border-white/5 bg-[#050505] flex items-center gap-2">
            <Terminal className="size-4 text-slate-500" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">sys_nextdrop.log</span>
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

        {/* ═══ ROW 3: JAM JAR FEED ════════════════════════════════════════ */}
        <motion.div variants={item} className="col-span-12 card-premium p-6 lg:p-8 flex flex-col lg:flex-row items-center gap-8 group">
          <div className="lg:w-1/3 space-y-3 shrink-0">
            <div className="flex items-center gap-2 text-primary">
              <Users className="size-5" />
              <h3 className="text-lg font-black tracking-tight text-white uppercase">Jam Jar Feed</h3>
            </div>
            <p className="text-sm font-medium text-slate-400">
              Real-time collab snippets from the community — open verses, snippets & collabs.
            </p>
            <Link href="/jamjar" className="inline-flex mt-2 items-center gap-2 px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors border border-white/10">
              Enter Jar <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Real posts horizontal feed */}
          <div className="flex-1 w-full overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg-card to-transparent z-10" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg-card to-transparent z-10" />
            <div className="flex w-fit gap-4 py-2 opacity-50 group-hover:opacity-100 transition-opacity duration-700">
              {feedPosts.length > 0
                ? feedPosts.map(post => (
                    <div key={post.id} className="w-[300px] shrink-0 bg-[#050505] border border-white/5 rounded-2xl p-4 flex gap-4 hover:border-white/20 transition-colors">
                      <div className="size-10 shrink-0 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                        {post.artist.profile_picture
                          ? <img src={post.artist.profile_picture} className="size-full object-cover" />
                          : <span className="text-xs font-black text-slate-400">{post.artist.stage_name.charAt(0)}</span>
                        }
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-bold text-white truncate">{post.content.slice(0, 40)}{post.content.length > 40 ? '…' : ''}</h4>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest truncate mt-1">
                          @{post.artist.stage_name}
                        </p>
                        <div className="mt-2 text-[9px] font-black text-secondary uppercase px-2 py-0.5 border border-secondary/20 bg-secondary/10 rounded-md inline-block">
                          Open Verse
                        </div>
                      </div>
                    </div>
                  ))
                : [1, 2, 3].map(i => (
                    <div key={i} className="w-[300px] shrink-0 bg-[#050505] border border-white/5 rounded-2xl p-4 flex gap-4">
                      <div className="size-10 shrink-0 rounded-full bg-slate-800 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-800 rounded animate-pulse w-3/4" />
                        <div className="h-2 bg-slate-800 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}