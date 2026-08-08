from enum import Enum
from typing import List, Dict, Any
from pydantic import BaseModel, Field


class IndianPlatformType(str, Enum):
    SPOTIFY_INDIA = "spotify_india"
    YOUTUBE_MUSIC = "youtube_music"
    INSTAGRAM_REELS = "instagram_reels"
    JIOSAAVN = "jiosaavn"
    WYNK_MUSIC = "wynk_music"
    GAANA = "gaana"


class IndiaFocusArea(BaseModel):
    region_code: str = Field(..., description="Indian state/metro code (e.g. MH, PB, DL, KA, TN, TS)")
    region_name: str
    primary_platform: IndianPlatformType
    opportunity_score: float = Field(..., ge=0.0, le=100.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    key_drivers: List[str]
    actionable_strategy: str


class IndiaTerritoryGrowthResponse(BaseModel):
    track_id: str
    minimum_data_met: bool
    top_focus_areas: List[IndiaFocusArea] = Field(default_factory=list)
    summary: str
    ai_analysis_payload: Dict[str, Any]


class RegionalWeeklyStats(BaseModel):
    week_index: int
    region_code: str
    platform: IndianPlatformType
    streams: int
    saves: int
    playlist_adds: int
    reels_ugc_count: int


class TrackIndiaTerritoryAnalytics(BaseModel):
    track_id: str
    genre: str = "hindi_indie"  # hindi_indie, punjabi_pop, desi_hip_hop, bollywood_pop, south_kollywood_tollywood
    regional_series: List[RegionalWeeklyStats]