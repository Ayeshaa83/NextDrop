"""
YouTube OAuth Endpoints
Handles Connect YouTube flow for artists.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx

from app.api import deps
from app.models import User, SocialAccount, SocialStats
from app.platforms.registry import registry
from app.sec.config import settings
from app.sec.encryption import encrypt_token, decrypt_token


router = APIRouter()


# ============ SCHEMAS ============

class YouTubeAuthUrl(BaseModel):
    auth_url: str


class YouTubeConnectionStatus(BaseModel):
    connected: bool
    provider: str
    channel_id: str | None = None
    channel_title: str | None = None
    thumbnail_url: str | None = None
    expires_at: datetime | None = None


class YouTubeChannelStats(BaseModel):
    channel_id: str
    channel_title: str
    thumbnail_url: str | None = None
    subscriber_count: int | None = None
    video_count: int | None = None
    view_count: int | None = None


# ============ ENDPOINTS ============

@router.get("/login", response_model=YouTubeAuthUrl)
def youtube_login(
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get YouTube/Google OAuth authorization URL.
    User must be logged in to connect YouTube.
    """
    state = f"user_{current_user.id}"
    youtube = registry.get_adapter("youtube")
    if not youtube:
        raise HTTPException(status_code=500, detail="YouTube platform adapter not configured")
    
    auth_url = youtube.get_auth_url(state=state)
    return YouTubeAuthUrl(auth_url=auth_url)


@router.get("/callback")
async def youtube_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(None, description="State parameter for CSRF"),
    error: str = Query(None, description="Error from Google"),
    db: Session = Depends(deps.get_db),
):
    """
    Handle YouTube/Google OAuth callback.
    """
    if error:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?youtube=error&message={error}"
        )
    
    user = None
    if state and state.startswith("user_"):
        try:
            user_id = int(state.split("_", 1)[1])
            user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        except (ValueError, IndexError):
            pass
    
    if not user:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?youtube=error&message=invalid_state"
        )
    
    try:
        youtube = registry.get_adapter("youtube")
        if not youtube:
            raise ValueError("YouTube adapter not found")

        # 1. Exchange code for tokens & profile data
        account_data = await youtube.exchange_code(code)
        
        # 2. Check if user already has a YouTube connection
        existing_account = db.query(SocialAccount).filter(
            SocialAccount.user_id == user.id,
            SocialAccount.provider == "youtube"
        ).first()
        
        if existing_account:
            # Encrypt tokens before saving
            if "access_token" in account_data:
                account_data["access_token"] = encrypt_token(account_data["access_token"])
            if "refresh_token" in account_data:
                account_data["refresh_token"] = encrypt_token(account_data["refresh_token"])
            for k, v in account_data.items():
                if hasattr(existing_account, k) and v is not None:
                    setattr(existing_account, k, v)
            existing_account.updated_at = datetime.utcnow()
        else:
            # Encrypt tokens before saving
            if "access_token" in account_data:
                account_data["access_token"] = encrypt_token(account_data["access_token"])
            if "refresh_token" in account_data:
                account_data["refresh_token"] = encrypt_token(account_data["refresh_token"])
            new_account = SocialAccount(
                user_id=user.id,
                provider="youtube",
                **account_data
            )
            db.add(new_account)
        
        db.commit()
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?youtube=success"
        )
        
    except ValueError:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?youtube=error&message=no_channel_found"
        )
    except httpx.HTTPStatusError:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?youtube=error&message=token_exchange_failed"
        )
    except Exception:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?youtube=error&message=unexpected_error"
        )


@router.get("/status", response_model=YouTubeConnectionStatus)
def youtube_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Check if current user has connected YouTube.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "youtube"
    ).first()
    
    if not account:
        return YouTubeConnectionStatus(connected=False, provider="youtube")
    
    is_expired = account.expires_at and account.expires_at < datetime.utcnow()
    
    return YouTubeConnectionStatus(
        connected=True,
        provider="youtube",
        channel_id=account.provider_user_id,
        channel_title=account.display_name,
        thumbnail_url=account.profile_image_url,
        expires_at=account.expires_at if not is_expired else None,
    )


@router.get("/stats", response_model=YouTubeChannelStats)
async def youtube_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    force_refresh: bool = Query(False, description="Force refresh from YouTube API, ignoring cache")
):
    """
    Fetch YouTube channel statistics with caching.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "youtube"
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No YouTube connection found. Please connect YouTube first."
        )
    
    if not force_refresh:
        cached_stats = db.query(SocialStats).filter(
            SocialStats.user_id == current_user.id,
            SocialStats.provider == "youtube"
        ).first()
        
        if cached_stats and not cached_stats.is_stale():
            return YouTubeChannelStats(
                channel_id=cached_stats.channel_id or account.provider_user_id,
                channel_title=cached_stats.channel_title or account.display_name,
                thumbnail_url=cached_stats.thumbnail_url or account.profile_image_url,
                subscriber_count=cached_stats.subscriber_count,
                video_count=cached_stats.video_count,
                view_count=cached_stats.view_count,
            )
    
    if account.expires_at and account.expires_at < datetime.utcnow():
        if not account.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="YouTube token expired. Please reconnect your account."
            )
        
        try:
            youtube = registry.get_adapter("youtube")
            if not youtube:
                raise ValueError("Adapter missing")
                
            new_tokens = await youtube.refresh_token(account)
            for k, v in new_tokens.items():
                if hasattr(account, k) and v is not None:
                    setattr(account, k, v)
            account.updated_at = datetime.utcnow()
            db.commit()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to refresh token. Please reconnect YouTube."
            )
    
    try:
        from app.platforms.youtube.adapter import youtube_adapter
        # Decrypt token before passing to external API
        decrypted_token = decrypt_token(account.access_token)
        channel = await youtube_adapter.get_channel_stats(decrypted_token)
        
        cached_stats = db.query(SocialStats).filter(
            SocialStats.user_id == current_user.id,
            SocialStats.provider == "youtube"
        ).first()
        
        if cached_stats:
            cached_stats.subscriber_count = channel.get("subscriber_count")
            cached_stats.view_count = channel.get("view_count")
            cached_stats.video_count = channel.get("video_count")
            cached_stats.channel_id = channel.get("channel_id")
            cached_stats.channel_title = channel.get("channel_title")
            cached_stats.thumbnail_url = channel.get("thumbnail_url")
            cached_stats.fetched_at = datetime.utcnow()
        else:
            cached_stats = SocialStats(
                user_id=current_user.id,
                provider="youtube",
                subscriber_count=channel.get("subscriber_count"),
                view_count=channel.get("view_count"),
                video_count=channel.get("video_count"),
                channel_id=channel.get("channel_id"),
                channel_title=channel.get("channel_title"),
                thumbnail_url=channel.get("thumbnail_url"),
                fetched_at=datetime.utcnow()
            )
            db.add(cached_stats)
        
        db.commit()
        
        return YouTubeChannelStats(
            channel_id=cached_stats.channel_id,
            channel_title=cached_stats.channel_title,
            thumbnail_url=cached_stats.thumbnail_url,
            subscriber_count=cached_stats.subscriber_count,
            video_count=cached_stats.video_count,
            view_count=cached_stats.view_count,
        )
    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch data from YouTube"
        )


@router.post("/refresh")
async def youtube_refresh_token(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Refresh the YouTube/Google access token.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "youtube"
    ).first()
    
    if not account or not account.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No refresh token available. Please reconnect YouTube."
        )
    
    try:
        youtube = registry.get_adapter("youtube")
        new_tokens = await youtube.refresh_token(account)
        for k, v in new_tokens.items():
            if hasattr(account, k) and v is not None:
                setattr(account, k, v)
        account.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Token refreshed successfully", "expires_at": account.expires_at}
    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to refresh token. Please reconnect YouTube."
        )


@router.delete("/disconnect")
def youtube_disconnect(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Disconnect YouTube.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "youtube"
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No YouTube connection found"
        )
    
    db.delete(account)
    db.commit()
    return {"message": "YouTube disconnected successfully"}


@router.get("/videos")
async def get_recent_videos(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Get the user's recently uploaded YouTube videos.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "youtube"
    ).first()
    
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not connected")
    
    if account.expires_at and account.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    
    try:
        from app.platforms.youtube.adapter import youtube_adapter
        # Decrypt token before passing to external API
        decrypted_token = decrypt_token(account.access_token)
        videos = await youtube_adapter.get_recent_videos(decrypted_token, max_results=limit)
        return {"items": videos, "total": len(videos)}
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="API error")
