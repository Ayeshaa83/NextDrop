"""
Spotify Platform Adapter
========================
Implements PlatformInterface for Spotify (OAuth2 + Web API).

Auth:         Spotify Authorization Code Flow with PKCE
Analytics:    Per-track stream counts, saves, and listener data
Distribution: Not supported (Spotify requires distributor agreements;
              use DistroKid, TuneCore etc. for actual distribution)
"""
import base64
from datetime import datetime, timedelta
from typing import Optional, Any
from urllib.parse import urlencode

import httpx

from app.platforms.base import PlatformInterface, DistributionResult, PlatformAnalytics
from app.models.social_auth import SocialAccount
from app.models.music import Track
from app.sec.config import settings


class SpotifyPlatformAdapter(PlatformInterface):
    """
    Spotify platform adapter.

    Scopes:
      user-read-private        : Read display name, country, product
      user-read-email          : Access user email
      user-top-read            : Top tracks and artists
      user-read-recently-played: Recently played tracks

    NOTE: Track-level analytics (streams, saves) are only available
    via the Spotify for Artists API which requires partner access.
    For now, we surface what the Web API allows: top tracks and
    recently played as a proxy for popularity.
    """

    AUTH_URL = "https://accounts.spotify.com/authorize"
    TOKEN_URL = "https://accounts.spotify.com/api/token"
    API_BASE = "https://api.spotify.com/v1"

    SCOPES = [
        "user-read-private",
        "user-read-email",
        "user-top-read",
        "user-read-recently-played",
    ]

    def __init__(self):
        self.client_id = settings.SPOTIFY_CLIENT_ID
        self.client_secret = settings.SPOTIFY_CLIENT_SECRET
        self.redirect_uri = settings.SPOTIFY_REDIRECT_URI

    # ── Identity ──────────────────────────────────────────────────────────────

    @property
    def platform_id(self) -> str:
        return "spotify"

    @property
    def platform_name(self) -> str:
        return "Spotify"

    @property
    def description(self) -> str:
        return "Sync listening history and top track data."

    @property
    def brand_color(self) -> str:
        return "#1DB954"

    @property
    def category(self) -> str:
        return "music"

    @property
    def supports_distribution(self) -> bool:
        # Direct distribution to Spotify requires a distributor agreement.
        # NextDrop does not have partner API access out of the box.
        return False

    @property
    def supports_analytics(self) -> bool:
        return True

    # ── Auth helpers ──────────────────────────────────────────────────────────

    def _basic_auth(self) -> str:
        creds = f"{self.client_id}:{self.client_secret}"
        return f"Basic {base64.b64encode(creds.encode()).decode()}"

    # ── Auth ──────────────────────────────────────────────────────────────────

    def get_auth_url(self, state: Optional[str] = None) -> str:
        """Build Spotify authorization URL."""
        params: dict[str, str] = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.SCOPES),
            "show_dialog": "false",
        }
        if state:
            params["state"] = state
        return f"{self.AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict[str, Any]:
        """Exchange Spotify authorization code for tokens + fetch user profile."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
                headers={
                    "Authorization": self._basic_auth(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            resp.raise_for_status()
            token_data = resp.json()

        expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
        access_token = token_data["access_token"]

        # Fetch profile
        profile = await self._get_profile(access_token)

        return {
            "access_token": access_token,
            "refresh_token": token_data.get("refresh_token"),
            "expires_at": expires_at,
            "provider_user_id": profile.get("id"),
            "display_name": profile.get("display_name"),
            "profile_image_url": profile.get("profile_image_url"),
        }

    async def refresh_token(self, account: SocialAccount) -> dict[str, Any]:
        """Refresh expired Spotify access token."""
        if not account.refresh_token:
            raise ValueError("No refresh token stored. User must reconnect Spotify.")

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": account.refresh_token,
                },
                headers={
                    "Authorization": self._basic_auth(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        expires_at = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600))
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", account.refresh_token),
            "expires_at": expires_at,
        }

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def _get_profile(self, access_token: str) -> dict[str, Any]:
        """Fetch authenticated user's Spotify profile."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.API_BASE}/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            data = resp.json()

        images = data.get("images", [])
        return {
            "id": data.get("id"),
            "display_name": data.get("display_name", data.get("id")),
            "email": data.get("email"),
            "profile_image_url": images[0]["url"] if images else None,
            "country": data.get("country"),
            "product": data.get("product"),
        }

    async def get_user_profile(self, access_token: str) -> dict[str, Any]:
        """Public method to fetch Spotify profile (used by status endpoints)."""
        return await self._get_profile(access_token)

    async def get_top_tracks(
        self,
        access_token: str,
        limit: int = 20,
        time_range: str = "medium_term",
    ) -> list[dict]:
        """Get user's top tracks from Spotify."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.API_BASE}/me/top/tracks",
                params={"limit": min(limit, 50), "time_range": time_range},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            return resp.json().get("items", [])

    async def get_top_artists(
        self,
        access_token: str,
        limit: int = 20,
        time_range: str = "medium_term",
    ) -> list[dict]:
        """Get user's top artists from Spotify."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.API_BASE}/me/top/artists",
                params={"limit": min(limit, 50), "time_range": time_range},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            return resp.json().get("items", [])

    # ── Distribution ──────────────────────────────────────────────────────────

    async def distribute(
        self,
        track: Track,
        account: SocialAccount,
        options: dict[str, Any] | None = None,
    ) -> DistributionResult:
        """
        Spotify does not allow direct track uploads via the Web API.
        Direct distribution requires agreements with Spotify's distributor partners
        (DistroKid, TuneCore, CD Baby, etc.).

        This method is intentionally a stub that returns a clear error.
        Future: integrate with a distributor's API here.
        """
        return DistributionResult.failure(
            "Spotify does not support direct track uploads. "
            "Use a distributor like DistroKid or TuneCore to publish to Spotify."
        )

    # ── Analytics ─────────────────────────────────────────────────────────────

    async def get_track_analytics(
        self,
        platform_track_id: str,
        account: SocialAccount,
    ) -> PlatformAnalytics:
        """
        Fetch track-level analytics from Spotify.

        The standard Web API provides track metadata and popularity score (0-100).
        Full streaming stats (monthly listeners, stream count, save rate) are only
        available via the Spotify for Artists dashboard or partner API.

        We return what the Web API provides: popularity score and metadata.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.API_BASE}/tracks/{platform_track_id}",
                headers={"Authorization": f"Bearer {account.access_token}"},
            )
            resp.raise_for_status()
            data = resp.json()

        # Popularity is 0-100 — proxy it as a streams approximation
        popularity = data.get("popularity", 0)

        return PlatformAnalytics(
            platform="spotify",
            platform_track_id=platform_track_id,
            # Spotify Web API does not expose raw stream counts
            streams=None,
            saves=None,
            skip_rate=None,
            # Encode popularity as a custom metric in raw
            raw={
                "popularity": popularity,
                "name": data.get("name"),
                "duration_ms": data.get("duration_ms"),
                "explicit": data.get("explicit"),
                "external_urls": data.get("external_urls", {}),
                "album": {
                    "name": data.get("album", {}).get("name"),
                    "release_date": data.get("album", {}).get("release_date"),
                },
            },
        )


# ── Singleton ─────────────────────────────────────────────────────────────────
spotify_adapter = SpotifyPlatformAdapter()
