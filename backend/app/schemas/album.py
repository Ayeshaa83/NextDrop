from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AlbumBase(BaseModel):
    title: str
    cover_art_url: Optional[str] = None

class AlbumCreate(AlbumBase):
    pass

class AlbumResponse(AlbumBase):
    id: int
    artist_id: int
    release_date: datetime

    class Config:
        from_attributes = True

class AlbumTrackLink(BaseModel):
    track_id: int
    position: int = 1

class AlbumWithTracks(AlbumResponse):
    tracks: List["TrackInAlbum"] = []

class TrackInAlbum(BaseModel):
    id: int
    title: str
    duration: int
    position: int

    class Config:
        from_attributes = True
