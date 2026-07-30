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

class ArtistApprovalStatus(str, enum.Enum):
    """Onboarding gate: new artists must be approved before they can upload."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    stage_name: Mapped[str] = mapped_column(String(100), index=True)
    bio: Mapped[str] = mapped_column(Text, nullable=True)
    profile_picture: Mapped[str] = mapped_column(String, nullable=True)
    # Onboarding approval (gates uploading/distributing)
    approval_status: Mapped[str] = mapped_column(
        String(20), default=ArtistApprovalStatus.PENDING.value,
        server_default="approved",  # existing artists stay usable
        index=True,
    )
    approval_reviewed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    # Admin-granted verification badge (separate honor, like a blue tick)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    verified_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    
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


class NotificationType(str, enum.Enum):
    TRACK_APPROVED = "track_approved"
    TRACK_REJECTED = "track_rejected"
    ARTIST_APPROVED = "artist_approved"
    ARTIST_REJECTED = "artist_rejected"
    PAYOUT_COMPLETED = "payout_completed"
    PAYOUT_REJECTED = "payout_rejected"
    VERIFICATION_GRANTED = "verification_granted"
    COLLAB_REQUEST = "collab_request"
    COLLAB_ACCEPTED = "collab_accepted"
    COLLAB_REJECTED = "collab_rejected"


class Notification(Base):
    """In-app notification (bell dropdown). Separate from — and sent
    alongside — the email in app/services/email_service.py."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    owner: Mapped["User"] = relationship()


class PlatformConfig(Base):
    """Admin-managed platform settings.

    For platforms with a real adapter, a row can disable them platform-wide.
    Rows without an adapter render as 'Coming Soon' placeholders — admins can
    add/edit these from the admin panel without code changes.
    """
    __tablename__ = "platform_configs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    platform_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(300), default="")
    color: Mapped[str] = mapped_column(String(9), default="#888888")
    category: Mapped[str] = mapped_column(String(20), default="music")  # music | video | social
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class PayoutStatus(str, enum.Enum):
    """Lifecycle of a (mock) payout request."""
    PROCESSING = "processing"  # Requested, awaiting admin action
    COMPLETED = "completed"    # Marked paid by admin
    REJECTED = "rejected"      # Declined; amount returned to balance


class Payout(Base):
    """A withdrawal request from an artist's wallet (mock money flow)."""
    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float] = mapped_column(nullable=False)
    method: Mapped[str] = mapped_column(String(30), default="bank_transfer")
    status: Mapped[str] = mapped_column(String(20), default=PayoutStatus.PROCESSING.value, index=True)
    reference: Mapped[str | None] = mapped_column(String(40), nullable=True)  # Mock txn id
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)

    owner: Mapped["User"] = relationship()