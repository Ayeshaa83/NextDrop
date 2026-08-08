from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class TagCategory(str, Enum):
    GENRE = "genre"
    MOOD = "mood"
    INSTRUMENT = "instrument"


class SuggestionAction(str, Enum):
    ADD = "add"
    REMOVE = "remove"
    REVIEW = "review"


class TagSuggestion(BaseModel):
    tag: str = Field(..., description="Canonical tag name")
    category: TagCategory = Field(..., description="Category of the tag")
    action: SuggestionAction = Field(..., description="Suggested action: add, remove, or review")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model prediction confidence")
    explanation: str = Field(..., description="Actionable human-readable explanation")


class MetadataSuggestionResponse(BaseModel):
    track_id: str
    quality_score: float = Field(..., ge=0.0, le=100.0, description="Overall metadata quality score (0-100)")
    predicted_language: Optional[str] = Field(None, description="ISO-639-1 language code")
    language_confidence: float = Field(0.0, ge=0.0, le=1.0)
    suggestions: List[TagSuggestion] = Field(default_factory=list)
    existing_tags: List[str] = Field(default_factory=list)
    summary: str = Field(..., description="High-level evaluation summary")
    ai_analysis_payload: Dict[str, Any] = Field(..., description="Payload ready for Track.ai_analysis DB column")