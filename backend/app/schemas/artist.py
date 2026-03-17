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

    class Config:
        from_attributes = True
