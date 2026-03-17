from pydantic import BaseModel
from typing import Optional
from enum import Enum

class CollaborationStatusEnum(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    COMPLETED = "completed"

class CollaborationCreate(BaseModel):
    collaborator_id: int
    track_id: Optional[int] = None
    message: Optional[str] = None

class CollaborationUpdate(BaseModel):
    status: CollaborationStatusEnum

class CollaborationResponse(BaseModel):
    id: int
    initiator_id: int
    collaborator_id: int
    track_id: Optional[int] = None
    status: CollaborationStatusEnum
    message: Optional[str] = None

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
