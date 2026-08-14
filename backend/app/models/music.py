from sqlalchemy import String, ForeignKey, Integer, Enum, JSON, Text
from sqlalchemy import text
from app.db.types import UTCDateTime as DateTime
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
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True)
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
    cover_art_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    genre: Mapped[str] = mapped_column(String(50), nullable=True)
    bpm: Mapped[int] = mapped_column(Integer, nullable=True)
    is_public: Mapped[bool] = mapped_column(default=True)

    # Release metadata
    isrc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_explicit: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    # Scheduled release: null = released immediately; future date = hidden
    # from public listings until the date passes.
    release_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)

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

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    artist: Mapped["Artist"] = relationship(back_populates="tracks")
    albums: Mapped[list["Album"]] = relationship(secondary="album_tracks", back_populates="tracks")
    
    # Social relationships
    # passive_deletes=True defers to each FK's own ondelete behavior (CASCADE
    # for split_sheets, SET NULL for social_posts/collaborations — see their
    # ForeignKey() declarations) instead of SQLAlchemy issuing its own
    # UPDATE/DELETE statements first, which could otherwise conflict with it.
    social_posts: Mapped[list["SocialPost"]] = relationship(back_populates="track", passive_deletes=True)
    collaborations: Mapped[list["Collaboration"]] = relationship(back_populates="track", passive_deletes=True)
    split_sheets: Mapped[list["TrackCollaborator"]] = relationship(back_populates="track", passive_deletes=True)

class TrackCollaborator(Base):
    __tablename__ = "track_collaborators"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    # Nullable: external collaborators (no NextDrop account) are stored by name only.
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    royalty_percentage: Mapped[float] = mapped_column(default=100.0)
    role: Mapped[str] = mapped_column(String(50), nullable=True) # e.g. "Producer", "Lyricist"

    track: Mapped["Track"] = relationship(back_populates="split_sheets")
    user: Mapped["User"] = relationship()


class DistributionStatus(str, enum.Enum):
    """Lifecycle status for a track distributed to a platform."""
    PENDING = "pending"         # Queued, not yet submitted
    PROCESSING = "processing"   # Upload in progress
    LIVE = "live"               # Publicly available on platform
    FAILED = "failed"           # Upload or processing error
    REMOVED = "removed"         # Taken down from platform


class TrackDistribution(Base):
    """
    Records which tracks have been distributed to which platforms.

    Each row = one (track, platform) pair.
    Stores the external platform ID (e.g. YouTube video ID) so we can later
    fetch per-track analytics from that platform.
    """
    __tablename__ = "track_distributions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"), index=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), index=True)

    # Platform identifier — must match the platform registry key
    platform: Mapped[str] = mapped_column(String(50), index=True)  # "youtube", "spotify", etc.

    # External identifier assigned by the platform after successful upload
    platform_track_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    platform_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Distribution lifecycle
    status: Mapped[str] = mapped_column(
        String(20),
        default=DistributionStatus.PENDING.value,
        index=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Platform-specific metadata (title used, privacy setting, tags, etc.)
    platform_metadata: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    # Selected territories (list of ISO country codes). Null/empty = worldwide.
    territories: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    distributed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    track: Mapped["Track"] = relationship()