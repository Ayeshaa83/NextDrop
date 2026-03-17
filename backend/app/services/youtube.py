"""
YouTube OAuth and Data API Service
Handles Google OAuth2 flow and YouTube Data API v3 calls.
"""
from datetime import datetime, timedelta
from urllib.parse import urlencode
import httpx
from pydantic import BaseModel

from app.sec.config import settings


# ============ SCHEMAS ============

class YouTubeTokens(BaseModel):
    access_token: str
    refresh_token: str | None
    expires_at: datetime
    token_type: str = "Bearer"
    

class YouTubeChannel(BaseModel):
    id: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    subscriber_count: int | None = None
    video_count: int | None = None
    view_count: int | None = None
    

class YouTubeStats(BaseModel):
    channel_id: str
    channel_title: str
    thumbnail_url: str | None = None
    subscriber_count: int | None = None
    video_count: int | None = None
    view_count: int | None = None


# ============ SERVICE ============

class YouTubeService:
    """
    Service for YouTube OAuth and Data API operations.
    Uses Google OAuth2 endpoints and YouTube Data API v3.
    """
    
    # Google OAuth2 endpoints
    AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    
    # YouTube Data API v3
    API_BASE_URL = "https://www.googleapis.com/youtube/v3"
    
    # OAuth scope for read-only access to YouTube data
    SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"]
    
    def __init__(self):
        self.client_id = settings.YOUTUBE_CLIENT_ID
        self.client_secret = settings.YOUTUBE_CLIENT_SECRET
        self.redirect_uri = settings.YOUTUBE_REDIRECT_URI
    
    def get_auth_url(self, state: str | None = None) -> str:
        """
        Generate Google OAuth2 authorization URL for YouTube.
        
        Args:
            state: Optional state parameter for CSRF protection
            
        Returns:
            Full authorization URL to redirect user to
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.SCOPES),
            "access_type": "offline",  # Required for refresh_token
            "prompt": "consent",  # Force consent to ensure refresh_token
        }
        
        if state:
            params["state"] = state
            
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"
    
    async def get_tokens(self, code: str) -> YouTubeTokens:
        """
        Exchange authorization code for access and refresh tokens.
        
        Args:
            code: Authorization code from Google OAuth callback
            
        Returns:
            YouTubeTokens with access_token, refresh_token, and expires_at
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()
            
            # Calculate expiration time
            # Google returns expires_in in seconds (typically 3600 = 1 hour)
            expires_in = data.get("expires_in", 3600)
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            return YouTubeTokens(
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token"),
                expires_at=expires_at,
                token_type=data.get("token_type", "Bearer"),
            )
    
    async def refresh_tokens(self, refresh_token: str) -> YouTubeTokens:
        """
        Refresh an expired access token using the refresh token.
        
        Args:
            refresh_token: The refresh token from initial authorization
            
        Returns:
            YouTubeTokens with new access_token (refresh_token may be same or new)
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()
            
            expires_in = data.get("expires_in", 3600)
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            return YouTubeTokens(
                access_token=data["access_token"],
                # Google may or may not return a new refresh_token
                refresh_token=data.get("refresh_token", refresh_token),
                expires_at=expires_at,
                token_type=data.get("token_type", "Bearer"),
            )
    
    async def get_channel_stats(self, access_token: str) -> YouTubeChannel:
        """
        Fetch the authenticated user's YouTube channel statistics.
        
        Args:
            access_token: Valid Google OAuth access token
            
        Returns:
            YouTubeChannel with id, title, thumbnail, and statistics
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.API_BASE_URL}/channels",
                params={
                    "part": "snippet,statistics",
                    "mine": "true",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
            
            # Check if user has a channel
            if not data.get("items"):
                raise ValueError("No YouTube channel found for this account")
            
            channel = data["items"][0]
            snippet = channel.get("snippet", {})
            statistics = channel.get("statistics", {})
            
            # Get best quality thumbnail
            thumbnails = snippet.get("thumbnails", {})
            thumbnail_url = None
            for quality in ["high", "medium", "default"]:
                if quality in thumbnails:
                    thumbnail_url = thumbnails[quality].get("url")
                    break
            
            return YouTubeChannel(
                id=channel["id"],
                title=snippet.get("title", ""),
                description=snippet.get("description"),
                thumbnail_url=thumbnail_url,
                subscriber_count=int(statistics.get("subscriberCount", 0)) if statistics.get("subscriberCount") else None,
                video_count=int(statistics.get("videoCount", 0)) if statistics.get("videoCount") else None,
                view_count=int(statistics.get("viewCount", 0)) if statistics.get("viewCount") else None,
            )
    
    async def get_recent_videos(
        self, 
        access_token: str, 
        max_results: int = 10
    ) -> list[dict]:
        """
        Fetch the user's recently uploaded videos.
        
        Args:
            access_token: Valid Google OAuth access token
            max_results: Maximum number of videos to return (1-50)
            
        Returns:
            List of video data dictionaries
        """
        async with httpx.AsyncClient() as client:
            # First, get the uploads playlist ID
            channel_response = await client.get(
                f"{self.API_BASE_URL}/channels",
                params={
                    "part": "contentDetails",
                    "mine": "true",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )
            channel_response.raise_for_status()
            channel_data = channel_response.json()
            
            if not channel_data.get("items"):
                return []
            
            uploads_playlist_id = (
                channel_data["items"][0]
                .get("contentDetails", {})
                .get("relatedPlaylists", {})
                .get("uploads")
            )
            
            if not uploads_playlist_id:
                return []
            
            # Fetch videos from uploads playlist
            videos_response = await client.get(
                f"{self.API_BASE_URL}/playlistItems",
                params={
                    "part": "snippet,contentDetails",
                    "playlistId": uploads_playlist_id,
                    "maxResults": min(max_results, 50),
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )
            videos_response.raise_for_status()
            videos_data = videos_response.json()
            
            videos = []
            for item in videos_data.get("items", []):
                snippet = item.get("snippet", {})
                thumbnails = snippet.get("thumbnails", {})
                thumbnail_url = thumbnails.get("high", thumbnails.get("default", {})).get("url")
                
                videos.append({
                    "video_id": item.get("contentDetails", {}).get("videoId"),
                    "title": snippet.get("title"),
                    "description": snippet.get("description"),
                    "published_at": snippet.get("publishedAt"),
                    "thumbnail_url": thumbnail_url,
                })
            
            return videos


# Singleton instance
youtube_service = YouTubeService()
