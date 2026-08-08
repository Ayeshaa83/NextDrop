from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DayOfWeek(str, Enum):
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"
    SATURDAY = "Saturday"
    SUNDAY = "Sunday"


class TargetMarket(str, Enum):
    INDIA_DOMESTIC = "india_domestic"
    GLOBAL_CROSSOVER = "global_crossover"
    NRI_DIASPORA = "nri_diaspora"


class ReleaseWindowOption(BaseModel):
    rank: int
    day_of_week: DayOfWeek
    recommended_time_ist: str = Field(..., description="Target release time in India Standard Time (IST)")
    composite_score: float = Field(..., ge=0.0, le=100.0)
    editorial_score: float = Field(..., ge=0.0, le=100.0)
    audience_score: float = Field(..., ge=0.0, le=100.0)
    genre_score: float = Field(..., ge=0.0, le=100.0)
    key_reasons: List[str]
    marketing_checklist: List[str]


class ReleaseTimingResponse(BaseModel):
    track_id: str
    target_market: TargetMarket
    lead_time_days: int
    editorial_pitch_eligible: bool = Field(..., description="True if lead time >= 14 days")
    optimal_window: ReleaseWindowOption
    alternative_windows: List[ReleaseWindowOption] = Field(default_factory=list)
    summary: str
    ai_analysis_payload: Dict[str, Any]


class ReleaseTimingRequest(BaseModel):
    track_id: str
    genre: str = "hindi_indie"  # hindi_indie, punjabi_pop, desi_hip_hop, bollywood_pop, lofi_romantic
    target_market: TargetMarket = TargetMarket.INDIA_DOMESTIC
    planned_lead_time_days: int = Field(14, description="Days between scheduling and release date")