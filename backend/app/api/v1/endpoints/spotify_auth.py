"""
Spotify OAuth Endpoints
Handles Connect Spotify flow for artists.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx

from app.api import deps
from app.models import User, SocialAccount
from app.services.spotify import spotify_service
from app.sec.config import settings


router = APIRouter()


# ============ SCHEMAS ============

class SpotifyAuthUrl(BaseModel):
    auth_url: str
    

class SpotifyConnectionStatus(BaseModel):
    connected: bool
    provider: str
    display_name: str | None = None
    profile_image_url: str | None = None
    provider_user_id: str | None = None
    expires_at: datetime | None = None


# ============ ENDPOINTS ============

@router.get("/login", response_model=SpotifyAuthUrl)
def spotify_login(
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get Spotify OAuth authorization URL.
    User must be logged in to connect Spotify.
    """
    # Generate state parameter with user ID for CSRF protection
    state = f"user_{current_user.id}"
    auth_url = spotify_service.get_auth_url(state=state)
    
    return SpotifyAuthUrl(auth_url=auth_url)


@router.get("/callback")
async def spotify_callback(
    code: str = Query(..., description="Authorization code from Spotify"),
    state: str = Query(None, description="State parameter for CSRF"),
    error: str = Query(None, description="Error from Spotify"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Handle Spotify OAuth callback.
    Exchanges code for tokens, fetches profile, and stores in DB.
    Redirects to frontend on completion.
    """
    # Handle errors from Spotify
    if error:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?spotify=error&message={error}"
        )
    
    try:
        # 1. Exchange code for tokens
        tokens = await spotify_service.get_tokens(code)
        
        # 2. Fetch user profile
        profile = await spotify_service.get_user_profile(tokens.access_token)
        
        # 3. Check if user already has a Spotify connection
        existing_account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.provider == "spotify"
        ).first()
        
        if existing_account:
            # Update existing connection
            existing_account.provider_user_id = profile.id
            existing_account.access_token = tokens.access_token
            existing_account.refresh_token = tokens.refresh_token
            existing_account.expires_at = tokens.expires_at
            existing_account.display_name = profile.display_name
            existing_account.profile_image_url = profile.profile_image_url
            existing_account.updated_at = datetime.utcnow()
        else:
            # Create new connection
            new_account = SocialAccount(
                user_id=current_user.id,
                provider="spotify",
                provider_user_id=profile.id,
                access_token=tokens.access_token,
                refresh_token=tokens.refresh_token,
                expires_at=tokens.expires_at,
                display_name=profile.display_name,
                profile_image_url=profile.profile_image_url,
            )
            db.add(new_account)
        
        db.commit()
        
        # 4. Redirect to frontend with success
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?spotify=success"
        )
        
    except httpx.HTTPStatusError as e:
        # Token exchange or API call failed
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?spotify=error&message=token_exchange_failed"
        )
    except Exception as e:
        # Unexpected error
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?spotify=error&message=unexpected_error"
        )


@router.get("/status", response_model=SpotifyConnectionStatus)
def spotify_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Check if current user has connected Spotify.
    Returns connection status and basic profile info.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account:
        return SpotifyConnectionStatus(connected=False, provider="spotify")
    
    # Check if token is expired
    is_expired = account.expires_at and account.expires_at < datetime.utcnow()
    
    return SpotifyConnectionStatus(
        connected=True,
        provider="spotify",
        display_name=account.display_name,
        profile_image_url=account.profile_image_url,
        provider_user_id=account.provider_user_id,
        expires_at=account.expires_at if not is_expired else None,
    )


@router.post("/refresh")
async def spotify_refresh_token(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Refresh the Spotify access token.
    Called when the current token is expired.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Spotify connection found"
        )
    
    if not account.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No refresh token available. Please reconnect Spotify."
        )
    
    try:
        # Refresh tokens
        new_tokens = await spotify_service.refresh_tokens(account.refresh_token)
        
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
            detail="Failed to refresh token. Please reconnect Spotify."
        )


@router.delete("/disconnect")
def spotify_disconnect(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Disconnect Spotify from the current user's account.
    Removes all stored tokens and profile data.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Spotify connection found"
        )
    
    db.delete(account)
    db.commit()
    
    return {"message": "Spotify disconnected successfully"}


@router.get("/top-tracks")
async def get_user_top_tracks(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    limit: int = Query(20, ge=1, le=50),
    time_range: str = Query("medium_term", regex="^(short_term|medium_term|long_term)$")
):
    """
    Get the user's top tracks from Spotify.
    Requires a valid Spotify connection.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Spotify connection found. Please connect Spotify first."
        )
    
    # Check token expiration
    if account.expires_at and account.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Spotify token expired. Please refresh or reconnect."
        )
    
    try:
        tracks = await spotify_service.get_top_tracks(
            account.access_token, 
            limit=limit, 
            time_range=time_range
        )
        return {"items": tracks, "total": len(tracks)}
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch data from Spotify"
        )


@router.get("/top-artists")
async def get_user_top_artists(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    limit: int = Query(20, ge=1, le=50),
    time_range: str = Query("medium_term", regex="^(short_term|medium_term|long_term)$")
):
    """
    Get the user's top artists from Spotify.
    Requires a valid Spotify connection.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Spotify connection found. Please connect Spotify first."
        )
    
    if account.expires_at and account.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Spotify token expired. Please refresh or reconnect."
        )
    
    try:
        artists = await spotify_service.get_top_artists(
            account.access_token, 
            limit=limit, 
            time_range=time_range
        )
        return {"items": artists, "total": len(artists)}
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch data from Spotify"
        )
