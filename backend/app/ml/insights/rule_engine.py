from pyexpat import features
from typing import List, Optional, Dict
from .schemas import PerformanceInsight, InsightCategory, InsightType


class StageARuleEngine:
    """Evaluates high-precision deterministic business heuristics (Stage A)."""

    def evaluate_rules(self, features: Dict[str, float]) -> List[PerformanceInsight]:
        insights: List[PerformanceInsight] = []

        wow_growth = features["wow_stream_growth"]
        wow_ugc = features["wow_ugc_growth"]
        save_rate = features["save_rate_current"]
        top_platform_share = features["top_platform_share"]

        # Rule: SMA Crossover Breakout Trend
        sma_ratio = features["sma_ratio"]
        wow_growth = features["wow_stream_growth"]

        if sma_ratio >= 1.25 and wow_growth >= 0.30:
            insights.append(PerformanceInsight(
                insight_type=InsightType.BREAKOUT_MOMENTUM,
                category=InsightCategory.GROWTH_TRAJECTORY,
                confidence=1.0,
                headline="Sustained Breakout Momentum",
                explanation_nl=f"Short-term stream momentum (2-week SMA) is {sma_ratio:.2f}x above the 4-week baseline average.",
                actionable_tip="This is a confirmed organic growth trend, not a 1-day spike. Consider increasing pitch efforts to major editorial playlists.",
                metrics_context={"sma_ratio": sma_ratio, "wow_stream_growth": wow_growth},
                rule_triggered=True
            ))

        # Rule 1: Viral UGC Driven Growth
        if wow_growth >= 0.40 and wow_ugc >= 0.60:
            insights.append(PerformanceInsight(
                insight_type=InsightType.VIRAL_UGC_DRIVEN,
                category=InsightCategory.PLATFORM_DYNAMICS,
                confidence=1.0,
                headline="TikTok & Short-Form UGC Driving Breakout Streams",
                explanation_nl=f"Weekly stream growth soared by {wow_growth:.0%}, heavily fueled by a {wow_ugc:.0%} surge in user-generated content.",
                actionable_tip="Capitalize on UGC momentum by pinning top viral clips and launching a dedicated social challenge.",
                metrics_context={"wow_stream_growth": wow_growth, "wow_ugc_growth": wow_ugc},
                rule_triggered=True
            ))

        # Rule 2: Low Saving Conversion (Audience Disconnect)
        if wow_growth >= 0.25 and save_rate < 0.015:
            insights.append(PerformanceInsight(
                insight_type=InsightType.LOW_SAVING_CONVERSION,
                category=InsightCategory.ENGAGEMENT_QUALITY,
                confidence=1.0,
                headline="High Stream Volume but Low Listener Retention",
                explanation_nl=f"Streams grew by {wow_growth:.0%}, but the stream-to-save rate is low ({save_rate:.1%}). Listeners aren't saving the track.",
                actionable_tip="Update your canvas/cover art and feature social calls-to-action encouraging fans to add the track to their library.",
                metrics_context={"wow_stream_growth": wow_growth, "save_rate": save_rate},
                rule_triggered=True
            ))

        # Rule 3: Single Platform Over-Concentration
        if top_platform_share >= 0.82:
            insights.append(PerformanceInsight(
                insight_type=InsightType.PLATFORM_CONCENTRATED,
                category=InsightCategory.PLATFORM_DYNAMICS,
                confidence=0.95,
                headline="Stream Distribution Heavily Concentrated on One Platform",
                explanation_nl=f"Over {top_platform_share:.0%} of all streams are coming from a single platform, creating distribution vulnerability.",
                actionable_tip="Cross-promote smart links pointing to alternative platforms (Apple Music/YouTube) to diversify reach.",
                metrics_context={"top_platform_share": top_platform_share},
                rule_triggered=True
            ))

        return insights