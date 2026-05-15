from sqlalchemy import String, ForeignKey, Integer, DateTime, Enum, JSON
from sqlalchemy import text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import datetime
import enum
from typing import Optional, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.core import Artist
    from app.models.social import SocialPost, Collaboration


class ProcessingStatus(str, enum.Enum):
    """Track processing status for async audio analysis."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ApprovalStatus(str, enum.Enum):
    """Track approval status for admin review."""
    PENDING = "pending"       # Awaiting admin review
    APPROVED = "approved"     # Cleared for public
    REJECTED = "rejected"     # Failed plagiarism/policy check
    UNDER_REVIEW = "under_review"  # Being actively reviewed


class AlbumTrack(Base):
    __tablename__ = "album_tracks"
    
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id"), primary_key=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, default=1) # Track order in album

class Album(Base):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"))
    title: Mapped[str] = mapped_column(String(200), index=True)
    release_date: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    cover_art_url: Mapped[str] = mapped_column(String, nullable=True)

    artist: Mapped["Artist"] = relationship(back_populates="albums")
    tracks: Mapped[list["Track"]] = relationship(secondary="album_tracks", back_populates="albums")

class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"))
    title: Mapped[str] = mapped_column(String(200), index=True)
    duration: Mapped[int] = mapped_column(Integer) # In seconds
    file_url: Mapped[str] = mapped_column(String)
    genre: Mapped[str] = mapped_column(String(50), nullable=True)
    bpm: Mapped[int] = mapped_column(Integer, nullable=True)
    is_public: Mapped[bool] = mapped_column(default=True)
    
    # Async processing fields
    processing_status: Mapped[str] = mapped_column(
        String(20), 
        default=ProcessingStatus.PENDING.value,
        index=True
    )
    ai_analysis: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)  # Librosa results
    processing_error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Admin approval fields
    approval_status: Mapped[str] = mapped_column(
    String(20), 
    nullable=False, 
    server_default=text("'pending'") 
    )
    approval_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    approved_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)

    artist: Mapped["Artist"] = relationship(back_populates="tracks")
    albums: Mapped[list["Album"]] = relationship(secondary="album_tracks", back_populates="tracks")
    
    # Social relationships
    social_posts: Mapped[list["SocialPost"]] = relationship(back_populates="track")
    collaborations: Mapped[list["Collaboration"]] = relationship(back_populates="track")
    split_sheets: Mapped[list["TrackCollaborator"]] = relationship(back_populates="track")

class TrackCollaborator(Base):
    __tablename__ = "track_collaborators"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    royalty_percentage: Mapped[float] = mapped_column(default=100.0)
    role: Mapped[str] = mapped_column(String(50), nullable=True) # e.g. "Producer", "Lyricist"

    track: Mapped["Track"] = relationship(back_populates="split_sheets")
    user: Mapped["User"] = relationship()