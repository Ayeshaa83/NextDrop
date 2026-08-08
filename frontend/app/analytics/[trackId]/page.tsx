'use client';

import { use } from 'react';
import SmartInsightCard from '@/components/ai/SmartInsightCard';
import TerritoryGrowthMap from '@/components/ai/TerritoryGrowthMap';
import AudioDNARadar from '@/components/ai/AudioDNARadar';
import ReleaseTimerDial from '@/components/ai/ReleaseTimerDial';
import { Sparkles, ArrowLeft, BarChart2, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function DeepAnalyticsPage({ params }: { params: Promise<{ trackId: string }> }) {
  const resolvedParams = use(params);
  const trackId = resolvedParams.trackId;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-10 max-w-[1600px] mx-auto space-y-8 font-sans">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/analytics"
            className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-1.5">
              <Sparkles className="size-3" /> Autonomous AI Performance Intelligence
            </p>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Deep Analytics <span className="text-slate-500 font-normal text-xl">({trackId})</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          <BarChart2 className="size-4" /> Live Algorithmic Tracking
        </div>
      </div>

      {/* 1. AI Strategic Performance Insights — Dual Card Banner */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Primary: TikTok UGC Surge */}
        <SmartInsightCard
          trackId={trackId}
          trackTitle="Neon Drive"
          currentStreams={24800}
          previousStreams={13400}
        />

        {/* Secondary: Sustained Breakout Momentum */}
        <SmartInsightCard
          trackId={`${trackId}_sma`}
          trackTitle="Neon Drive"
          currentStreams={32100}
          previousStreams={29800}
          fallbackInsight={{
            headline: 'Sustained Breakout Momentum (SMA Crossover)',
            body: `"Neon Drive" shows a sustained 7-day SMA crossover above the 30-day SMA — a strong signal of breakout momentum consolidation beyond the initial UGC spike.`,
            trend: 'up',
            percentage_change: 7.7,
            tip: 'Submit to Spotify editorial playlists now — sustained momentum tracks have 3× higher acceptance rates in the 14-day post-spike window.',
          }}
        />
      </section>

      {/* 2. Middle Section: India Territory & Platform Focus Areas + Audio DNA Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* India Territory & Platform Focus Areas */}
        <TerritoryGrowthMap trackId={trackId} />

        {/* Audio DNA Radar Chart */}
        <AudioDNARadar trackId={trackId} trackTitle="Neon Drive" />
      </div>

      {/* 3. Release Timing & Golden Window Strategy */}
      <section>
        <ReleaseTimerDial trackId={trackId} genre="hindi_indie" targetMarket="india_domestic" />
      </section>
    </div>
  );
}

