from sqlalchemy import String, Boolean, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import datetime
import enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.music import Album, Track
    from app.models.social_auth import SocialAccount, SocialStats
    from app.models.social import SocialPost, Comment, PostLike, Collaboration


class UserRole(str, enum.Enum):
    """User roles for RBAC."""
    USER = "user"
    ARTIST = "artist"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True, default=None)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(
        String(20), 
        default=UserRole.USER.value,
        index=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationship to Artist Profile
    artist_profile: Mapped["Artist"] = relationship(back_populates="owner", uselist=False)
    
    # Social OAuth accounts (Spotify, etc.)
    social_accounts: Mapped[list["SocialAccount"]] = relationship(back_populates="user")
    
    # Cached social stats (YouTube, Spotify stats cached to avoid API quota limits)
    social_stats: Mapped[list["SocialStats"]] = relationship(back_populates="user")

class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    stage_name: Mapped[str] = mapped_column(String(100), index=True)
    bio: Mapped[str] = mapped_column(Text, nullable=True)
    profile_picture: Mapped[str] = mapped_column(String, nullable=True)
    
    # Relationships
    owner: Mapped["User"] = relationship(back_populates="artist_profile")
    albums: Mapped[list["Album"]] = relationship(back_populates="artist")
    tracks: Mapped[list["Track"]] = relationship(back_populates="artist")
    
    # Social relationships
    social_posts: Mapped[list["SocialPost"]] = relationship(back_populates="artist")
    comments: Mapped[list["Comment"]] = relationship(back_populates="artist")
    post_likes: Mapped[list["PostLike"]] = relationship(back_populates="artist")
    initiated_collabs: Mapped[list["Collaboration"]] = relationship(foreign_keys="Collaboration.initiator_id", back_populates="initiator")
    received_collabs: Mapped[list["Collaboration"]] = relationship(foreign_keys="Collaboration.collaborator_id", back_populates="collaborator")

class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    balance: Mapped[float] = mapped_column(default=0.0)
    
    owner: Mapped["User"] = relationship()