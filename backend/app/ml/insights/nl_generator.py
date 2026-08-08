from typing import Dict, Any
from .schemas import InsightType, InsightCategory, PerformanceInsight


class TemplateNLGenerator:
    """Stage C: Deterministic Natural Language template generator."""

    TEMPLATES = {
        InsightType.BREAKOUT_MOMENTUM: {
            "headline": "Breakout Stream Velocity Detected",
            "explanation": "Stream volume accelerated by {wow_stream_growth:.0%} week-over-week with strong multi-platform traction.",
            "tip": "Submit track for official editorial playlist consideration and increase ad spend while momentum is high."
        },
        InsightType.STEADY_GROWTH: {
            "headline": "Consistent Listener Reach Growth",
            "explanation": "Consistent upward trajectory with normalized 4-week stream growth slope at +{stream_slope_normalized:.2f}.",
            "tip": "Maintain community engagement and share behind-the-scenes content to convert casual listeners to core fans."
        },
        InsightType.DECLINING_TRAJECTORY: {
            "headline": "Momentum Slowdown Detected",
            "explanation": "Weekly stream volume declined by {wow_stream_growth:.0%} compared to the previous week's baseline.",
            "tip": "Re-engage audience with acoustic versions, remixes, or targeted playlist outreach to reignite algorithm plays."
        },
        InsightType.HIGH_RETENTION_PASSION: {
            "headline": "Exceptional Listener Save Rate",
            "explanation": "Outstanding listener passion with a {save_rate_current:.1%} save rate (well above industry benchmark).",
            "tip": "Your listeners love this track. Focus on direct-to-fan marketing, merch, and tour ticket announcements."
        },
        InsightType.PLAYLIST_DEPENDENT: {
            "headline": "Growth Strongly Reliant on Playlist Additions",
            "explanation": "Playlist conversion rate reached {playlist_add_conversion:.2f}, indicating passive ecosystem listening.",
            "tip": "Drive direct off-platform traffic (Instagram/TikTok) to build active artist affinity beyond passive playlists."
        }
    }

    def generate_insight(
        self,
        insight_type: InsightType,
        category: InsightCategory,
        confidence: float,
        metrics: Dict[str, float]
    ) -> PerformanceInsight:
        
        tpl = self.TEMPLATES.get(insight_type, {
            "headline": f"Performance Update: {insight_type.value.replace('_', ' ').title()}",
            "explanation": "Analytics pattern detected based on recent time-series metrics.",
            "tip": "Review performance metrics in detail on the main dashboard."
        })

        # Safely format template with fallback metrics
        fmt_metrics = {k: abs(v) for k, v in metrics.items()}
        headline = tpl["headline"].format(**fmt_metrics)
        explanation = tpl["explanation"].format(**fmt_metrics)
        tip = tpl["tip"].format(**fmt_metrics)

        return PerformanceInsight(
            insight_type=insight_type,
            category=category,
            confidence=round(confidence, 3),
            headline=headline,
            explanation_nl=explanation,
            actionable_tip=tip,
            metrics_context=metrics,
            rule_triggered=False
        )