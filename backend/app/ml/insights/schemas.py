from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class InsightCategory(str, Enum):
    GROWTH_TRAJECTORY = "growth_trajectory"
    PLATFORM_DYNAMICS = "platform_dynamics"
    ENGAGEMENT_QUALITY = "engagement_quality"
    CURATION_IMPACT = "curation_impact"
    ACTION_REQUIRED = "action_required"


class InsightType(str, Enum):
    # Growth & Velocity
    BREAKOUT_MOMENTUM = "breakout_momentum"
    STEADY_GROWTH = "steady_growth"
    DECLINING_TRAJECTORY = "declining_trajectory"
    
    # Platform & UGC
    VIRAL_UGC_DRIVEN = "viral_ugc_driven"
    PLATFORM_CONCENTRATED = "platform_concentrated"
    
    # Engagement & Quality
    HIGH_RETENTION_PASSION = "high_retention_passion"
    LOW_SAVING_CONVERSION = "low_saving_conversion"
    
    # Playlist & Curation
    PLAYLIST_DEPENDENT = "playlist_dependent"
    UNTAPPED_CURATION_POTENTIAL = "untapped_curation_potential"


class PerformanceInsight(BaseModel):
    insight_type: InsightType
    category: InsightCategory
    confidence: float = Field(..., ge=0.0, le=1.0)
    headline: str
    explanation_nl: str
    actionable_tip: str
    metrics_context: Dict[str, float]
    rule_triggered: bool = False


class WeeklyAnalyticsPoint(BaseModel):
    week_index: int  # 0 = current week, 1 = last week, etc.
    streams: int
    saves: int
    playlist_adds: int
    ugc_count: int
    platform_shares: Dict[str, float]  # e.g. {"spotify": 0.60, "apple": 0.25, "youtube": 0.15}


class TrackAnalyticsTimeSeries(BaseModel):
    track_id: str
    weekly_data: List[WeeklyAnalyticsPoint]  # Sorted newest (0) to oldest (N)