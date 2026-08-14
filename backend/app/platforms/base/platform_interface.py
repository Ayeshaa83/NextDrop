"""
Platform Adapter Base — Abstract Interface
==========================================
All platform adapters must implement PlatformInterface.
This ensures the distribution system can call any platform
through a single, consistent API surface.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Any

from app.models.social_auth import SocialAccount
from app.models.music import Track


class PlatformInterface(ABC):
    """
    Abstract base class for all platform adapters.

    Each platform (YouTube, Spotify, Apple Music, …) implements
    this interface. The core distribution engine never imports
    platform-specific code directly — it uses the registry to
    get a PlatformInterface instance.

    Three capability groups:
        1. Auth — OAuth token exchange and refresh
        2. Distribution — upload / publish a track
        3. Analytics — per-track stats retrieval
    """

    # ── Identity ──────────────────────────────────────────────────────────────

    @property
    @abstractmethod
    def platform_id(self) -> str:
        """Unique string key (matches TrackDistribution.platform). e.g. 'youtube'"""

    @property
    @abstractmethod
    def platform_name(self) -> str:
        """Human-readable name, e.g. 'YouTube'"""

    # ── Display metadata (drives the integrations hub & distribution UI) ──────
    # Override these so the frontend can render the platform without any
    # hardcoded per-platform code. Sensible defaults are derived from the id.

    @property
    def description(self) -> str:
        """Short one-line description shown on the platform card."""
        return f"Connect your {self.platform_name} account."

    @property
    def brand_color(self) -> str:
        """Brand hex color used for the platform card accent."""
        return "#888888"

    @property
    def category(self) -> str:
        """One of: 'music', 'video', 'social'."""
        return "music"

    @property
    def login_endpoint(self) -> str | None:
        """API path the frontend calls to start the OAuth flow."""
        return f"/api/v1/{self.platform_id}/login"

    @property
    def disconnect_endpoint(self) -> str | None:
        """API path the frontend calls to disconnect the account."""
        return f"/api/v1/{self.platform_id}/disconnect"

    # ── Auth ──────────────────────────────────────────────────────────────────

    @abstractmethod
    def get_auth_url(self, state: Optional[str] = None) -> str:
        """
        Build the OAuth authorization URL to redirect the user to.
        The state parameter is used to link the callback back to a user.
        """

    @abstractmethod
    async def exchange_code(self, code: str) -> dict[str, Any]:
        """
        Exchange an authorization code for tokens.

        Returns a dict compatible with SocialAccount fields:
          access_token, refresh_token, expires_at, display_name,
          profile_image_url, provider_user_id
        """

    @abstractmethod
    async def refresh_token(self, account: SocialAccount) -> dict[str, Any]:
        """
        Refresh an expired access token in-place.

        Returns updated fields: access_token, refresh_token, expires_at
        """

    # ── Capability flags ──────────────────────────────────────────────────────

    @property
    def supports_distribution(self) -> bool:
        """Override to True if this platform can accept track uploads."""
        return False

    @property
    def supports_analytics(self) -> bool:
        """Override to True if per-track analytics are available."""
        return False

    # ── Distribution ──────────────────────────────────────────────────────────

    async def distribute(
        self,
        track: Track,
        account: SocialAccount,
        options: dict[str, Any] | None = None,
    ) -> "DistributionResult":
        """
        Upload / publish a track to the platform.

        Raises NotImplementedError if supports_distribution is False.
        Returns a DistributionResult.
        """
        raise NotImplementedError(
            f"{self.platform_name} does not support distribution yet."
        )

    # ── Analytics ─────────────────────────────────────────────────────────────

    async def get_track_analytics(
        self,
        platform_track_id: str,
        account: SocialAccount,
    ) -> "PlatformAnalytics":
        """
        Fetch per-track analytics from the platform.

        Raises NotImplementedError if supports_analytics is False.
        Returns a PlatformAnalytics dataclass.
        """
        raise NotImplementedError(
            f"{self.platform_name} analytics are not implemented yet."
        )

    # ── Removal ───────────────────────────────────────────────────────────────
    # Two distinct, deliberately different-severity actions. Adapters that
    # don't support distribution don't need to implement either.

    async def unpublish(self, platform_track_id: str, account: SocialAccount) -> bool:
        """
        Reversible takedown — make the live content private/unlisted rather
        than removing it. The artist (or NextDrop) can restore it later
        without re-uploading. Used by the "Unpublish" action, which keeps
        the track's own record and history intact on our side too.
        """
        raise NotImplementedError(
            f"{self.platform_name} does not support unpublishing."
        )

    async def delete_content(self, platform_track_id: str, account: SocialAccount) -> bool:
        """
        Permanent, irreversible removal from the platform. Used only by the
        "Hard Delete" action — the platform-side counterpart to actually
        deleting the track's own record.
        """
        raise NotImplementedError(
            f"{self.platform_name} does not support deletion."
        )


# ── Shared result types (imported by all adapters) ────────────────────────────

from dataclasses import dataclass, field
from app.models.music import DistributionStatus


@dataclass
class DistributionResult:
    """Returned by PlatformInterface.distribute()"""
    status: str = DistributionStatus.PENDING.value
    platform_track_id: Optional[str] = None
    platform_url: Optional[str] = None
    error_message: Optional[str] = None
    platform_metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def success(
        cls,
        platform_track_id: str,
        platform_url: str,
        metadata: dict | None = None,
    ) -> "DistributionResult":
        return cls(
            status=DistributionStatus.LIVE.value,
            platform_track_id=platform_track_id,
            platform_url=platform_url,
            platform_metadata=metadata or {},
        )

    @classmethod
    def failure(cls, error: str) -> "DistributionResult":
        return cls(status=DistributionStatus.FAILED.value, error_message=error)


@dataclass
class PlatformAnalytics:
    """Returned by PlatformInterface.get_track_analytics()"""
    platform: str
    platform_track_id: str
    views: Optional[int] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None
    watch_time_minutes: Optional[int] = None   # YouTube-specific
    streams: Optional[int] = None              # Spotify-specific
    saves: Optional[int] = None               # Spotify-specific
    skip_rate: Optional[float] = None         # Spotify-specific (0-1)
    raw: dict[str, Any] = field(default_factory=dict)  # Full platform response
    fetched_at: datetime = field(default_factory=datetime.utcnow)
