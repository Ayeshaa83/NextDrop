"""
Social Models for NextDrop Feed System.
Handles social posts, comments, likes (hypes), and collaborations.
"""
from sqlalchemy import String, ForeignKey, Text, Enum, Integer, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import datetime
import enum
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.core import Artist
    from app.models.music import Track


class CollaborationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    COMPLETED = "completed"
    REJECTED = "rejected"


class PostType(str, enum.Enum):
    """Types of social posts."""
    SNIPPET = "snippet"       # Music snippet drop (Jam Jar)
    OPEN_VERSE = "open_verse" # Looking for collaborators
    GENERAL = "general"       # General update/announcement


# ============ SOCIAL POST MODELS ============

class SocialPost(Base):
    """
    A social post in the feed.
    Artists can "drop" music snippets, request collaborations, or make announcements.
    """
    __tablename__ = "social_posts"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), index=True)
    track_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tracks.id"), nullable=True, index=True)
    
    content: Mapped[str] = mapped_column(Text)  # Post text/caption
    post_type: Mapped[str] = mapped_column(
        String(20), 
        default=PostType.GENERAL.value,
        index=True
    )
    
    # Engagement counters (denormalized for performance)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    artist: Mapped["Artist"] = relationship(back_populates="social_posts")
    track: Mapped[Optional["Track"]] = relationship(back_populates="social_posts")
    comments: Mapped[list["Comment"]] = relationship(back_populates="post", cascade="all, delete-orphan")
    likes: Mapped[list["PostLike"]] = relationship(back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    """Comment on a social post."""
    __tablename__ = "comments"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("social_posts.id", ondelete="CASCADE"), index=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), index=True)
    
    text: Mapped[str] = mapped_column(String(1000))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    
    # Relationships
    post: Mapped["SocialPost"] = relationship(back_populates="comments")
    artist: Mapped["Artist"] = relationship(back_populates="comments")


class PostLike(Base):
    """
    Like/Hype on a social post.
    Composite primary key prevents duplicate likes.
    """
    __tablename__ = "post_likes"
    
    post_id: Mapped[int] = mapped_column(ForeignKey("social_posts.id", ondelete="CASCADE"), primary_key=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), primary_key=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    
    # Relationships
    post: Mapped["SocialPost"] = relationship(back_populates="likes")
    artist: Mapped["Artist"] = relationship(back_populates="post_likes")


# ============ COLLABORATION MODELS ============

class Collaboration(Base):
    """
    Collaboration request between artists.
    Can be triggered from Open Verse posts or direct requests.
    """
    __tablename__ = "collaborations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    initiator_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), index=True)
    collaborator_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), index=True)
    track_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tracks.id"), nullable=True)
    post_id: Mapped[Optional[int]] = mapped_column(ForeignKey("social_posts.id"), nullable=True)  # Source post if from feed
    
    status: Mapped[str] = mapped_column(
        String(20),
        default=CollaborationStatus.PENDING.value,
        index=True
    )
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    initiator: Mapped["Artist"] = relationship(foreign_keys=[initiator_id], back_populates="initiated_collabs")
    collaborator: Mapped["Artist"] = relationship(foreign_keys=[collaborator_id], back_populates="received_collabs")
    track: Mapped[Optional["Track"]] = relationship(back_populates="collaborations")
    post: Mapped[Optional["SocialPost"]] = relationship()


class Leaderboard(Base):
    __tablename__ = "leaderboard"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"))
    rank: Mapped[int] = mapped_column(Integer)
    points: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(50)) # e.g., "Viral", "Most Collaborative"