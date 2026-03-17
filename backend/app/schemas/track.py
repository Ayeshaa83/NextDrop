from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum


class ProcessingStatusEnum(str, Enum):
    """Track processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TrackBase(BaseModel):
    title: str
    duration: int  # In seconds
    file_url: str
    genre: Optional[str] = None
    bpm: Optional[int] = None
    is_public: bool = True

class TrackCreate(TrackBase):
    pass

class TrackUpdate(BaseModel):
    title: Optional[str] = None
    duration: Optional[int] = None
    file_url: Optional[str] = None
    genre: Optional[str] = None
    bpm: Optional[int] = None
    is_public: Optional[bool] = None

class TrackResponse(TrackBase):
    id: int
    artist_id: int
    processing_status: ProcessingStatusEnum = ProcessingStatusEnum.PENDING
    ai_analysis: Optional[dict] = None
    processing_error: Optional[str] = None

    class Config:
        from_attributes = True


class TrackProcessingStatus(BaseModel):
    """Response for processing status check."""
    id: int
    title: str
    processing_status: ProcessingStatusEnum
    processing_error: Optional[str] = None
    ai_analysis: Optional[dict] = None

    class Config:
        from_attributes = True


class AIAnalysisResponse(BaseModel):
    """Extracted AI analysis data."""
    features: Optional[dict] = None
    predicted_genre: Optional[str] = None
    genre_confidence: Optional[float] = None
    hit_score: Optional[float] = None
    hit_factors: Optional[dict] = None
    similar_tracks: Optional[list] = None
    recommendations: Optional[list] = None


# ── Standalone /analyze endpoint schemas ─────────────────────────────────

class AnalyzeTagItem(BaseModel):
    """A single tag with name and confidence score."""
    name: str
    confidence: int  # 0-100


class AnalyzeFileResponse(BaseModel):
    """Response for the standalone file-upload /analyze endpoint."""
    bpm: Optional[float] = None
    key: Optional[str] = None
    genre: list[AnalyzeTagItem] = []
    style: list[AnalyzeTagItem] = []
    mood: list[AnalyzeTagItem] = []
    instruments: list[AnalyzeTagItem] = []
    vocals: list[AnalyzeTagItem] = []
    hit_score: Optional[float] = None
    features: Optional[dict] = None
    hit_factors: Optional[dict] = None
    tags_raw: Optional[list] = None
    musicnn_error: Optional[str] = None
