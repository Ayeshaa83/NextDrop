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
from app.services.youtube import youtube_service
from app.sec.config import settings


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
    # Generate state parameter with user ID for CSRF protection
    state = f"user_{current_user.id}"
    auth_url = youtube_service.get_auth_url(state=state)
    
    return YouTubeAuthUrl(auth_url=auth_url)


@router.get("/callback")
async def youtube_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(None, description="State parameter for CSRF"),
    error: str = Query(None, description="Error from Google"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Handle YouTube/Google OAuth callback.
    Exchanges code for tokens, fetches channel info, and stores in DB.
    Redirects to frontend on completion.
    """
    # Handle errors from Google
    if error:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?youtube=error&message={error}"
        )
    
    try:
        # 1. Exchange code for tokens
        tokens = await youtube_service.get_tokens(code)
        
        # 2. Fetch channel info
        channel = await youtube_service.get_channel_stats(tokens.access_token)
        
        # 3. Check if user already has a YouTube connection
        existing_account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.provider == "youtube"
        ).first()
        
        if existing_account:
            # Update existing connection
            existing_account.provider_user_id = channel.id
            existing_account.access_token = tokens.access_token
            existing_account.refresh_token = tokens.refresh_token
            existing_account.expires_at = tokens.expires_at
            existing_account.display_name = channel.title
            existing_account.profile_image_url = channel.thumbnail_url
            existing_account.updated_at = datetime.utcnow()
        else:
            # Create new connection
            new_account = SocialAccount(
                user_id=current_user.id,
                provider="youtube",
                provider_user_id=channel.id,
                access_token=tokens.access_token,
                refresh_token=tokens.refresh_token,
                expires_at=tokens.expires_at,
                display_name=channel.title,
                profile_image_url=channel.thumbnail_url,
            )
            db.add(new_account)
        
        db.commit()
        
        # 4. Redirect to frontend with success
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?youtube=success"
        )
        
    except ValueError as e:
        # No YouTube channel found
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?youtube=error&message=no_channel_found"
        )
    except httpx.HTTPStatusError as e:
        # Token exchange or API call failed
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?youtube=error&message=token_exchange_failed"
        )
    except Exception as e:
        # Unexpected error
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?youtube=error&message=unexpected_error"
        )


@router.get("/status", response_model=YouTubeConnectionStatus)
def youtube_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Check if current user has connected YouTube.
    Returns connection status and basic channel info.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "youtube"
    ).first()
    
    if not account:
        return YouTubeConnectionStatus(connected=False, provider="youtube")
    
    # Check if token is expired
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
    
    Stats are cached for 6 hours to avoid hitting Google's 10,000 unit/day quota.
    Use force_refresh=true to bypass cache (use sparingly).
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
    
    # Check for cached stats first (unless force_refresh is requested)
    if not force_refresh:
        cached_stats = db.query(SocialStats).filter(
            SocialStats.user_id == current_user.id,
            SocialStats.provider == "youtube"
        ).first()
        
        if cached_stats and not cached_stats.is_stale():
            # Return cached stats
            return YouTubeChannelStats(
                channel_id=cached_stats.channel_id or account.provider_user_id,
                channel_title=cached_stats.channel_title or account.display_name,
                thumbnail_url=cached_stats.thumbnail_url or account.profile_image_url,
                subscriber_count=cached_stats.subscriber_count,
                video_count=cached_stats.video_count,
                view_count=cached_stats.view_count,
            )
    
    # Check token expiration and refresh if needed
    if account.expires_at and account.expires_at < datetime.utcnow():
        if not account.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="YouTube token expired. Please reconnect your account."
            )
        
        try:
            # Refresh the token
            new_tokens = await youtube_service.refresh_tokens(account.refresh_token)
            account.access_token = new_tokens.access_token
            account.refresh_token = new_tokens.refresh_token
            account.expires_at = new_tokens.expires_at
            account.updated_at = datetime.utcnow()
            db.commit()
        except httpx.HTTPStatusError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to refresh token. Please reconnect YouTube."
            )
    
    try:
        # Fetch fresh stats from YouTube API (costs 1 quota unit)
        channel = await youtube_service.get_channel_stats(account.access_token)
        
        # Update or create cached stats
        cached_stats = db.query(SocialStats).filter(
            SocialStats.user_id == current_user.id,
            SocialStats.provider == "youtube"
        ).first()
        
        if cached_stats:
            # Update existing cache
            cached_stats.subscriber_count = channel.subscriber_count
            cached_stats.view_count = channel.view_count
            cached_stats.video_count = channel.video_count
            cached_stats.channel_id = channel.id
            cached_stats.channel_title = channel.title
            cached_stats.thumbnail_url = channel.thumbnail_url
            cached_stats.fetched_at = datetime.utcnow()
        else:
            # Create new cache entry
            cached_stats = SocialStats(
                user_id=current_user.id,
                provider="youtube",
                subscriber_count=channel.subscriber_count,
                view_count=channel.view_count,
                video_count=channel.video_count,
                channel_id=channel.id,
                channel_title=channel.title,
                thumbnail_url=channel.thumbnail_url,
                fetched_at=datetime.utcnow(),
            )
            db.add(cached_stats)
        
        db.commit()
        
        return YouTubeChannelStats(
            channel_id=channel.id,
            channel_title=channel.title,
            thumbnail_url=channel.thumbnail_url,
            subscriber_count=channel.subscriber_count,
            video_count=channel.video_count,
            view_count=channel.view_count,
        )
    except httpx.HTTPStatusError as e:
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
    Called when the current token is expired.
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
    
    if not account.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No refresh token available. Please reconnect YouTube."
        )
    
    try:
        # Refresh tokens
        new_tokens = await youtube_service.refresh_tokens(account.refresh_token)
        
        # Update database
        account.access_token = new_tokens.access_token
        account.refresh_token = new_tokens.refresh_token
        account.expires_at = new_tokens.expires_at
        account.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {"message": "Token refreshed successfully", "expires_at": new_tokens.expires_at}
        
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
    Disconnect YouTube from the current user's account.
    Removes all stored tokens and channel data.
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
    max_results: int = Query(10, ge=1, le=50)
):
    """
    Get the user's recently uploaded YouTube videos.
    Requires a valid YouTube connection.
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
    
    # Check token expiration
    if account.expires_at and account.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="YouTube token expired. Please refresh or reconnect."
        )
    
    try:
        videos = await youtube_service.get_recent_videos(
            account.access_token, 
            max_results=max_results
        )
        return {"items": videos, "total": len(videos)}
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch videos from YouTube"
        )
