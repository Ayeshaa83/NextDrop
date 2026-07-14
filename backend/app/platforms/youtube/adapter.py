"""
YouTube Platform Adapter
========================
Implements PlatformInterface for YouTube (Google OAuth2 + Data API v3).

Auth:         Google OAuth2 (youtube.readonly + youtube.upload scopes)
Distribution: Upload audio as video via YouTube Data API resumable upload
Analytics:    Per-video statistics (views, likes, comments, watch time)
"""
import os
import json
import subprocess
import tempfile
from datetime import datetime, timedelta
from typing import Optional, Any
from urllib.parse import urlencode

import httpx

from app.platforms.base import PlatformInterface, DistributionResult, PlatformAnalytics
from app.models.social_auth import SocialAccount
from app.models.music import Track
from app.sec.config import settings


class YouTubePlatformAdapter(PlatformInterface):
    """
    YouTube platform adapter.

    Scopes requested:
      - youtube.readonly   : read channel stats, video analytics
      - youtube.upload     : upload videos (for distribution)

    NOTE: Adding `youtube.upload` scope means existing connected users will
    need to re-consent (one-time re-connect). This is unavoidable because
    Google only issues upload-capable tokens when the scope is in the request.
    """

    # ── Google OAuth endpoints ────────────────────────────────────────────────
    AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    REVOKE_URL = "https://oauth2.googleapis.com/revoke"

    # ── YouTube Data API v3 base URL ─────────────────────────────────────────
    API_BASE = "https://www.googleapis.com/youtube/v3"
    UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3"

    # ── OAuth scopes ──────────────────────────────────────────────────────────
    SCOPES = [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
    ]

    def __init__(self):
        self.client_id = settings.YOUTUBE_CLIENT_ID
        self.client_secret = settings.YOUTUBE_CLIENT_SECRET
        self.redirect_uri = settings.YOUTUBE_REDIRECT_URI

    # ── Identity ──────────────────────────────────────────────────────────────

    @property
    def platform_id(self) -> str:
        return "youtube"

    @property
    def platform_name(self) -> str:
        return "YouTube"

    @property
    def description(self) -> str:
        return "Display subscriber count, total views, and video stats."

    @property
    def brand_color(self) -> str:
        return "#FF0000"

    @property
    def category(self) -> str:
        return "video"

    @property
    def supports_distribution(self) -> bool:
        return True

    @property
    def supports_analytics(self) -> bool:
        return True

    # ── Auth ──────────────────────────────────────────────────────────────────

    def get_auth_url(self, state: Optional[str] = None) -> str:
        """
        Build Google OAuth2 authorization URL with both readonly and upload scopes.
        Uses `access_type=offline` and `prompt=consent` to guarantee a refresh token.
        """
        params: dict[str, str] = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.SCOPES),
            "access_type": "offline",
            "prompt": "consent",   # Always show consent — needed for upload scope
        }
        if state:
            params["state"] = state
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict[str, Any]:
        """Exchange OAuth code → tokens, fetch channel info, return SocialAccount fields."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
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
            resp.raise_for_status()
            token_data = resp.json()

        expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
        access_token = token_data["access_token"]

        # Fetch channel info to populate display_name / provider_user_id
        channel = await self._get_channel(access_token)

        return {
            "access_token": access_token,
            "refresh_token": token_data.get("refresh_token"),
            "expires_at": expires_at,
            "provider_user_id": channel.get("id"),
            "display_name": channel.get("title"),
            "profile_image_url": channel.get("thumbnail_url"),
        }

    async def refresh_token(self, account: SocialAccount) -> dict[str, Any]:
        """Refresh an expired access token using the stored refresh token."""
        if not account.refresh_token:
            raise ValueError("No refresh token stored. User must reconnect YouTube.")

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": account.refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
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

    async def _get_channel(self, access_token: str) -> dict[str, Any]:
        """Fetch the authenticated user's primary YouTube channel details."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.API_BASE}/channels",
                params={"part": "snippet,statistics", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            data = resp.json()

        if not data.get("items"):
            return {}

        ch = data["items"][0]
        snippet = ch.get("snippet", {})
        thumbnails = snippet.get("thumbnails", {})
        thumb = (
            thumbnails.get("high")
            or thumbnails.get("medium")
            or thumbnails.get("default")
            or {}
        )
        return {
            "id": ch.get("id"),
            "title": snippet.get("title"),
            "thumbnail_url": thumb.get("url"),
        }

    async def get_channel_stats(self, access_token: str) -> dict[str, Any]:
        """Fetch channel-level statistics (subscriber count, total views, video count)."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.API_BASE}/channels",
                params={"part": "snippet,statistics", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            data = resp.json()

        if not data.get("items"):
            raise ValueError("No YouTube channel found for this account")

        ch = data["items"][0]
        snippet = ch.get("snippet", {})
        stats = ch.get("statistics", {})
        thumbnails = snippet.get("thumbnails", {})
        thumb = (thumbnails.get("high") or thumbnails.get("medium") or thumbnails.get("default") or {})

        return {
            "channel_id": ch.get("id"),
            "channel_title": snippet.get("title", ""),
            "thumbnail_url": thumb.get("url"),
            "subscriber_count": int(stats["subscriberCount"]) if stats.get("subscriberCount") else None,
            "video_count": int(stats["videoCount"]) if stats.get("videoCount") else None,
            "view_count": int(stats["viewCount"]) if stats.get("viewCount") else None,
        }

    async def get_recent_videos(self, access_token: str, max_results: int = 10) -> list[dict]:
        """Fetch list of the user's recently uploaded videos."""
        async with httpx.AsyncClient() as client:
            # Get uploads playlist ID from channel contentDetails
            ch_resp = await client.get(
                f"{self.API_BASE}/channels",
                params={"part": "contentDetails", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            ch_resp.raise_for_status()
            ch_data = ch_resp.json()

            if not ch_data.get("items"):
                return []

            uploads_id = (
                ch_data["items"][0]
                .get("contentDetails", {})
                .get("relatedPlaylists", {})
                .get("uploads")
            )
            if not uploads_id:
                return []

            # Fetch playlist items
            pl_resp = await client.get(
                f"{self.API_BASE}/playlistItems",
                params={
                    "part": "snippet,contentDetails",
                    "playlistId": uploads_id,
                    "maxResults": min(max_results, 50),
                },
                headers={"Authorization": f"Bearer {access_token}"},
            )
            pl_resp.raise_for_status()
            pl_data = pl_resp.json()

        videos = []
        for item in pl_data.get("items", []):
            sn = item.get("snippet", {})
            thumbs = sn.get("thumbnails", {})
            thumb_url = (thumbs.get("high") or thumbs.get("default") or {}).get("url")
            videos.append({
                "video_id": item.get("contentDetails", {}).get("videoId"),
                "title": sn.get("title"),
                "description": sn.get("description"),
                "published_at": sn.get("publishedAt"),
                "thumbnail_url": thumb_url,
            })
        return videos

    # ── Distribution ──────────────────────────────────────────────────────────

    async def distribute(
        self,
        track: Track,
        account: SocialAccount,
        options: dict[str, Any] | None = None,
    ) -> DistributionResult:
        """
        Upload a track to YouTube as a video.

        Process:
          1. Download audio file from its URL (or locate from local storage)
          2. Merge audio + cover art into an MP4 using ffmpeg
          3. Upload to YouTube Data API v3 using resumable upload
          4. Return DistributionResult with the video ID

        Options:
          title       : Video title (defaults to track.title)
          description : Video description
          privacy     : 'private' | 'unlisted' | 'public' (default: 'unlisted')
          tags        : list of tag strings
          category_id : YouTube category ID (default: '10' = Music)
        """
        opts = options or {}
        privacy = opts.get("privacy", "unlisted")
        title = opts.get("title", track.title)
        description = opts.get("description", f"Distributed via NextDrop | {track.genre or ''}")
        tags = opts.get("tags", [track.genre] if track.genre else [])
        category_id = opts.get("category_id", "10")  # 10 = Music

        # ── Step 1: Prepare the audio file ───────────────────────────────────
        audio_path = await self._resolve_audio_path(track)
        if not audio_path:
            return DistributionResult.failure("Audio file not accessible for distribution")

        # ── Step 2: Convert audio → video using ffmpeg ───────────────────────
        video_path = await self._audio_to_video(audio_path, track)
        if not video_path:
            return DistributionResult.failure(
                "ffmpeg is not installed or audio-to-video conversion failed. "
                "Install ffmpeg on the server to enable YouTube distribution."
            )

        try:
            # ── Step 3: Upload to YouTube ────────────────────────────────────
            video_metadata = {
                "snippet": {
                    "title": title[:100],  # YouTube max title length
                    "description": description[:5000],
                    "tags": tags[:500],   # YouTube tag limit
                    "categoryId": category_id,
                },
                "status": {
                    "privacyStatus": privacy,
                    "selfDeclaredMadeForKids": False,
                },
            }

            video_id = await self._upload_video(
                access_token=account.access_token,
                video_path=video_path,
                metadata=video_metadata,
            )

            if not video_id:
                return DistributionResult.failure("YouTube upload returned no video ID")

            video_url = f"https://www.youtube.com/watch?v={video_id}"
            return DistributionResult.success(
                platform_track_id=video_id,
                platform_url=video_url,
                metadata={
                    "title": title,
                    "privacy": privacy,
                    "category_id": category_id,
                    "tags": tags,
                },
            )

        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            if status_code == 401:
                return DistributionResult.failure("YouTube token expired. Please reconnect.")
            elif status_code == 403:
                return DistributionResult.failure(
                    "YouTube API quota exceeded or permission denied. "
                    "Ensure the youtube.upload scope is granted."
                )
            return DistributionResult.failure(f"YouTube API error {status_code}: {e.response.text[:200]}")
        except Exception as e:
            return DistributionResult.failure(f"Unexpected error during YouTube upload: {str(e)}")
        finally:
            # Clean up temp video file
            if video_path and os.path.exists(video_path):
                try:
                    os.unlink(video_path)
                except OSError:
                    pass

    async def _resolve_audio_path(self, track: Track) -> Optional[str]:
        """
        Resolve a locally-accessible path for the track's audio file.
        For S3 URLs: downloads to a temp file.
        For local paths: returns as-is.
        """
        file_url = track.file_url or ""

        # Local file (starts with / or a drive letter on Windows)
        if file_url.startswith("/") or (len(file_url) > 1 and file_url[1] == ":"):
            return file_url if os.path.exists(file_url) else None

        # Local mock URL from our own API
        if "localhost" in file_url or "127.0.0.1" in file_url:
            # Extract the path segment — e.g. /api/v1/storage/local/tracks/1/file.mp3
            # This points to a local upload directory
            parts = file_url.split("/api/v1/storage/local/", 1)
            if len(parts) == 2:
                from app.api.v1.endpoints.storage import LOCAL_UPLOADS_DIR
                local_path = os.path.join(LOCAL_UPLOADS_DIR, parts[1])
                return local_path if os.path.exists(local_path) else None
            return None

        # S3 / HTTPS URL — download to a temp file
        if file_url.startswith("http"):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.get(file_url)
                    resp.raise_for_status()
                # Write to temp file with correct extension
                ext = os.path.splitext(file_url)[1] or ".mp3"
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
                tmp.write(resp.content)
                tmp.close()
                return tmp.name
            except Exception:
                return None

        return None

    async def _audio_to_video(self, audio_path: str, track: Track) -> Optional[str]:
        """
        Use ffmpeg to combine audio with a static image (cover art or black frame)
        to produce an MP4 video suitable for YouTube upload.

        Returns path to the generated video file, or None if ffmpeg is unavailable.
        """
        try:
            # Check ffmpeg is available
            result = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                timeout=5,
            )
            if result.returncode != 0:
                return None
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None  # ffmpeg not installed

        output_path = tempfile.mktemp(suffix=".mp4")

        # Build ffmpeg command
        # If cover art is available, use it; otherwise use a black frame
        if track.cover_art_url and track.cover_art_url.startswith("/"):
            # Local cover art
            cmd = [
                "ffmpeg", "-y",
                "-loop", "1", "-i", track.cover_art_url,   # Static image
                "-i", audio_path,                           # Audio track
                "-c:v", "libx264",
                "-tune", "stillimage",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-shortest",
                "-movflags", "+faststart",
                output_path,
            ]
        else:
            # Black frame 1920x1080
            cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi", "-i", "color=c=black:size=1920x1080:rate=1",
                "-i", audio_path,
                "-c:v", "libx264",
                "-tune", "stillimage",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-shortest",
                "-movflags", "+faststart",
                output_path,
            ]

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                timeout=300,  # 5 min max
            )
            if proc.returncode == 0 and os.path.exists(output_path):
                return output_path
            return None
        except subprocess.TimeoutExpired:
            return None
        except Exception:
            return None

    async def _upload_video(
        self,
        access_token: str,
        video_path: str,
        metadata: dict,
    ) -> Optional[str]:
        """
        Upload a video to YouTube using the resumable upload API.
        Returns the YouTube video ID on success.
        """
        file_size = os.path.getsize(video_path)

        async with httpx.AsyncClient(timeout=600.0) as client:
            # ── Step 1: Initiate resumable upload session ─────────────────────
            init_resp = await client.post(
                f"{self.UPLOAD_BASE}/videos",
                params={
                    "uploadType": "resumable",
                    "part": "snippet,status",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                    "X-Upload-Content-Type": "video/mp4",
                    "X-Upload-Content-Length": str(file_size),
                },
                content=json.dumps(metadata).encode(),
            )
            init_resp.raise_for_status()
            upload_url = init_resp.headers.get("Location")
            if not upload_url:
                return None

            # ── Step 2: Upload the binary in one PUT ──────────────────────────
            with open(video_path, "rb") as f:
                video_data = f.read()

            upload_resp = await client.put(
                upload_url,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Length": str(file_size),
                },
                content=video_data,
            )
            upload_resp.raise_for_status()
            video_data_response = upload_resp.json()

        return video_data_response.get("id")

    # ── Analytics ─────────────────────────────────────────────────────────────

    async def get_track_analytics(
        self,
        platform_track_id: str,
        account: SocialAccount,
    ) -> PlatformAnalytics:
        """
        Fetch per-video statistics from YouTube Data API.
        Returns views, likes, comments, and favoriteCount.

        NOTE: Watch time (minutes watched) requires the YouTube Analytics API
        which needs additional setup. It is included as None for now.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.API_BASE}/videos",
                params={
                    "part": "statistics",
                    "id": platform_track_id,
                },
                headers={"Authorization": f"Bearer {account.access_token}"},
            )
            resp.raise_for_status()
            data = resp.json()

        items = data.get("items", [])
        if not items:
            raise ValueError(f"Video {platform_track_id} not found on YouTube")

        stats = items[0].get("statistics", {})
        return PlatformAnalytics(
            platform="youtube",
            platform_track_id=platform_track_id,
            views=int(stats["viewCount"]) if stats.get("viewCount") else None,
            likes=int(stats["likeCount"]) if stats.get("likeCount") else None,
            comments=int(stats["commentCount"]) if stats.get("commentCount") else None,
            raw=stats,
        )


# ── Singleton ─────────────────────────────────────────────────────────────────
youtube_adapter = YouTubePlatformAdapter()
