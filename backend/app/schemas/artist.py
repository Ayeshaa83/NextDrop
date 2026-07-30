from pydantic import BaseModel
from typing import Optional

class ArtistBase(BaseModel):
    stage_name: str
    bio: Optional[str] = None
    profile_picture: Optional[str] = None

class ArtistCreate(ArtistBase):
    pass

class ArtistUpdate(BaseModel):
    stage_name: Optional[str] = None
    bio: Optional[str] = None
    profile_picture: Optional[str] = None

class ArtistResponse(ArtistBase):
    id: int
    user_id: int
    is_verified: bool = False
    approval_status: str = "approved"

    class Config:
        from_attributes = True


class ArtistPublicProfile(ArtistBase):
    """
    Public-facing artist card/profile — used by the Explore directory and
    the artist detail page. Only ever built from approved artists, so it
    intentionally omits approval_status (nothing pending is ever exposed).
    """
    id: int
    user_id: int
    is_verified: bool = False
    rank: int
    track_count: int = 0
    total_streams: int = 0

    class Config:
        from_attributes = True
