"""
Spotify OAuth Service
Handles authentication and API calls to Spotify.
"""
import httpx
import base64
from datetime import datetime, timedelta
from urllib.parse import urlencode
from typing import Optional
from dataclasses import dataclass

from app.sec.config import settings


@dataclass
class SpotifyTokens:
    """Token response from Spotify."""
    access_token: str
    refresh_token: Optional[str]
    expires_at: datetime
    token_type: str


@dataclass
class SpotifyProfile:
    """User profile from Spotify."""
    id: str
    display_name: str
    email: Optional[str]
    profile_image_url: Optional[str]
    country: Optional[str]
    product: Optional[str]  # "premium", "free", etc.


class SpotifyService:
    """
    Async service for Spotify OAuth and API.
    Uses httpx.AsyncClient for all requests.
    """
    
    AUTH_URL = "https://accounts.spotify.com/authorize"
    TOKEN_URL = "https://accounts.spotify.com/api/token"
    API_BASE_URL = "https://api.spotify.com/v1"
    
    # Scopes for NextDrop
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
    
    def _get_basic_auth_header(self) -> str:
        """Create Basic auth header for token requests."""
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    def get_auth_url(self, state: Optional[str] = None) -> str:
        """
        Generate Spotify authorization URL.
        
        Args:
            state: Optional CSRF state parameter
            
        Returns:
            Full authorization URL to redirect user to
        """
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.SCOPES),
            "show_dialog": "false",  # Set to "true" to always show consent
        }
        
        if state:
            params["state"] = state
            
        return f"{self.AUTH_URL}?{urlencode(params)}"
    
    async def get_tokens(self, code: str) -> SpotifyTokens:
        """
        Exchange authorization code for access and refresh tokens.
        
        Args:
            code: Authorization code from Spotify callback
            
        Returns:
            SpotifyTokens with access_token, refresh_token, expires_at
            
        Raises:
            httpx.HTTPStatusError: If token exchange fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
                headers={
                    "Authorization": self._get_basic_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            response.raise_for_status()
            data = response.json()
            
            # Calculate expiration time
            expires_in = data.get("expires_in", 3600)  # Default 1 hour
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            return SpotifyTokens(
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token"),
                expires_at=expires_at,
                token_type=data.get("token_type", "Bearer"),
            )
    
    async def refresh_tokens(self, refresh_token: str) -> SpotifyTokens:
        """
        Refresh an expired access token.
        
        Args:
            refresh_token: Valid refresh token
            
        Returns:
            New SpotifyTokens (may include new refresh_token)
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
                headers={
                    "Authorization": self._get_basic_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            response.raise_for_status()
            data = response.json()
            
            expires_in = data.get("expires_in", 3600)
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            return SpotifyTokens(
                access_token=data["access_token"],
                # Spotify may return a new refresh token or we keep the old one
                refresh_token=data.get("refresh_token", refresh_token),
                expires_at=expires_at,
                token_type=data.get("token_type", "Bearer"),
            )
    
    async def get_user_profile(self, access_token: str) -> SpotifyProfile:
        """
        Fetch the authenticated user's Spotify profile.
        
        Args:
            access_token: Valid Spotify access token
            
        Returns:
            SpotifyProfile with user details
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.API_BASE_URL}/me",
                headers={
                    "Authorization": f"Bearer {access_token}",
                },
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract profile image (first one if available)
            images = data.get("images", [])
            profile_image = images[0]["url"] if images else None
            
            return SpotifyProfile(
                id=data["id"],
                display_name=data.get("display_name", data["id"]),
                email=data.get("email"),
                profile_image_url=profile_image,
                country=data.get("country"),
                product=data.get("product"),
            )
    
    async def get_top_tracks(self, access_token: str, limit: int = 20, time_range: str = "medium_term") -> list[dict]:
        """
        Get user's top tracks.
        
        Args:
            access_token: Valid Spotify access token
            limit: Number of tracks to return (max 50)
            time_range: "short_term" (4 weeks), "medium_term" (6 months), "long_term" (years)
            
        Returns:
            List of track objects
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.API_BASE_URL}/me/top/tracks",
                params={"limit": limit, "time_range": time_range},
                headers={
                    "Authorization": f"Bearer {access_token}",
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])
    
    async def get_top_artists(self, access_token: str, limit: int = 20, time_range: str = "medium_term") -> list[dict]:
        """
        Get user's top artists.
        
        Args:
            access_token: Valid Spotify access token
            limit: Number of artists to return (max 50)
            time_range: "short_term", "medium_term", "long_term"
            
        Returns:
            List of artist objects
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.API_BASE_URL}/me/top/artists",
                params={"limit": limit, "time_range": time_range},
                headers={
                    "Authorization": f"Bearer {access_token}",
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])


# Singleton instance
spotify_service = SpotifyService()
