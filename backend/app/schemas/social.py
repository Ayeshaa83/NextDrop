from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class CollaborationStatusEnum(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    COMPLETED = "completed"
    REJECTED = "rejected"

class CollaborationCreate(BaseModel):
    collaborator_id: int
    track_id: Optional[int] = None
    message: Optional[str] = None

class CollaborationUpdate(BaseModel):
    status: CollaborationStatusEnum

class CollaborationTrackUpdate(BaseModel):
    track_id: int

class ArtistSummary(BaseModel):
    """Minimal public artist identity, embedded in collaboration cards."""
    id: int
    stage_name: str
    profile_picture: Optional[str] = None
    is_verified: bool = False

    class Config:
        from_attributes = True

class CollaborationResponse(BaseModel):
    id: int
    initiator_id: int
    collaborator_id: int
    track_id: Optional[int] = None
    status: CollaborationStatusEnum
    message: Optional[str] = None
    created_at: datetime
    initiator: Optional[ArtistSummary] = None
    collaborator: Optional[ArtistSummary] = None
    track_title: Optional[str] = None
    unread_count: int = 0

    class Config:
        from_attributes = True

class CollabMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class CollabMessageResponse(BaseModel):
    id: int
    collaboration_id: int
    sender_id: int
    content: str
    created_at: datetime
    is_mine: bool = False

    class Config:
        from_attributes = True

class LeaderboardResponse(BaseModel):
    id: int
    artist_id: int
    rank: int
    points: int
    category: str

    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    rank: int
    artist_id: int
    stage_name: str
    points: int
    profile_picture: Optional[str] = None
