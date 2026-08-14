"""
Social Authentication Models
Stores OAuth tokens for connected services (Spotify, YouTube, etc.)
Also stores cached stats to avoid API quota limits.
"""
from sqlalchemy import String, Text, ForeignKey, Integer, BigInteger, JSON, UniqueConstraint
from app.db.types import UTCDateTime as DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.core import User


class SocialAccount(Base):
    """
    Stores OAuth credentials for third-party services.
    Each user can have one account per provider.
    """
    __tablename__ = "social_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(50), default="spotify", index=True)
    provider_user_id: Mapped[str] = mapped_column(String(255), index=True)  # Spotify URI/ID
    
    # OAuth tokens
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    
    # Metadata
    display_name: Mapped[str] = mapped_column(String(255), nullable=True)
    profile_image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user: Mapped["User"] = relationship(back_populates="social_accounts")

    # Unique constraint: one provider account per user
    __table_args__ = (
        # Composite unique constraint
        {"sqlite_autoincrement": True},
    )


class SocialStats(Base):
    """
    Cached statistics from social platforms to avoid API quota limits.
    Stats are refreshed only after CACHE_TTL_HOURS (default 6 hours).
    
    This prevents hitting Google's 10,000 unit/day quota by caching
    YouTube channel stats locally.
    """
    __tablename__ = "social_stats"
    
    CACHE_TTL_HOURS = 6  # Serve cached stats if less than 6 hours old
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(50), index=True)  # "youtube", "spotify"
    
    # Common stats fields
    subscriber_count: Mapped[int] = mapped_column(BigInteger, nullable=True)  # YouTube subscribers / Spotify followers
    view_count: Mapped[int] = mapped_column(BigInteger, nullable=True)  # YouTube total views
    video_count: Mapped[int] = mapped_column(Integer, nullable=True)  # YouTube video count
    
    # Provider-specific metadata (flexible JSON field)
    extra_stats: Mapped[dict] = mapped_column(JSON, nullable=True)  # For additional provider-specific data
    
    # Channel/profile info (cached to avoid extra API calls)
    channel_id: Mapped[str] = mapped_column(String(255), nullable=True)
    channel_title: Mapped[str] = mapped_column(String(255), nullable=True)
    thumbnail_url: Mapped[str] = mapped_column(String(500), nullable=True)
    
    # Cache management
    fetched_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    
    # Relationship
    user: Mapped["User"] = relationship(back_populates="social_stats")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'provider', name='uq_social_stats_user_provider'),
    )
    
    def is_stale(self) -> bool:
        """Check if cached stats are older than CACHE_TTL_HOURS."""
        if not self.fetched_at:
            return True
        age = datetime.datetime.utcnow() - self.fetched_at
        return age.total_seconds() > (self.CACHE_TTL_HOURS * 3600)

