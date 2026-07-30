from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
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
    cover_art_url: Optional[str] = None
    genre: Optional[str] = None
    bpm: Optional[int] = None
    is_public: bool = True
    isrc: Optional[str] = None
    is_explicit: bool = False
    release_date: Optional[datetime] = None  # Null = release immediately


class CollaboratorInput(BaseModel):
    """A split-sheet entry. Name-only collaborators are allowed."""
    name: str
    role: Optional[str] = None
    royalty_percentage: float = Field(..., ge=0, le=100)


class TrackCreate(TrackBase):
    collaborators: list[CollaboratorInput] = []


class TrackUpdate(BaseModel):
    title: Optional[str] = None
    duration: Optional[int] = None
    file_url: Optional[str] = None
    cover_art_url: Optional[str] = None
    genre: Optional[str] = None
    bpm: Optional[int] = None
    is_public: Optional[bool] = None
    isrc: Optional[str] = None
    is_explicit: Optional[bool] = None
    release_date: Optional[datetime] = None


class PublicTrackResponse(BaseModel):
    """Track card for a public artist profile page — no owner-only fields."""
    id: int
    title: str
    duration: int
    file_url: str
    cover_art_url: Optional[str] = None
    genre: Optional[str] = None
    bpm: Optional[int] = None
    is_explicit: bool = False
    created_at: Optional[datetime] = None
    stream_count: int = 0

    class Config:
        from_attributes = True


class CollaboratorResponse(BaseModel):
    id: int
    display_name: Optional[str] = None
    role: Optional[str] = None
    royalty_percentage: float

    class Config:
        from_attributes = True


class TrackResponse(TrackBase):
    id: int
    artist_id: int
    processing_status: ProcessingStatusEnum = ProcessingStatusEnum.PENDING
    ai_analysis: Optional[dict] = None
    processing_error: Optional[str] = None
    approval_status: Optional[str] = None
    approval_notes: Optional[str] = None
    created_at: Optional[datetime] = None

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
