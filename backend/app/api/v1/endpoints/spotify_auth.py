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
from app.platforms.registry import registry
from app.sec.config import settings
from app.sec.encryption import encrypt_token, decrypt_token


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
    """
    state = f"user_{current_user.id}"
    spotify = registry.get_adapter("spotify")
    if not spotify:
        raise HTTPException(status_code=500, detail="Adapter missing")
        
    auth_url = spotify.get_auth_url(state=state)
    return SpotifyAuthUrl(auth_url=auth_url)


@router.get("/callback")
async def spotify_callback(
    code: str = Query(..., description="Authorization code from Spotify"),
    state: str = Query(None, description="State parameter for CSRF"),
    error: str = Query(None, description="Error from Spotify"),
    db: Session = Depends(deps.get_db),
):
    """
    Handle Spotify OAuth callback.
    """
    if error:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?spotify=error&message={error}"
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
            url=f"{settings.FRONTEND_URL}/integrations?spotify=error&message=invalid_state"
        )
    
    try:
        spotify = registry.get_adapter("spotify")
        
        # 1. Exchange code for tokens
        account_data = await spotify.exchange_code(code)
        
        # 2. Check if user already has a Spotify connection
        existing_account = db.query(SocialAccount).filter(
            SocialAccount.user_id == user.id,
            SocialAccount.provider == "spotify"
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
                provider="spotify",
                **account_data
            )
            db.add(new_account)
        
        db.commit()
        
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?spotify=success"
        )
        
    except httpx.HTTPStatusError:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?spotify=error&message=token_exchange_failed"
        )
    except Exception:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/integrations?spotify=error&message=unexpected_error"
        )


@router.get("/status", response_model=SpotifyConnectionStatus)
def spotify_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Check if current user has connected Spotify.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account:
        return SpotifyConnectionStatus(connected=False, provider="spotify")
    
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
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account or not account.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No refresh token available. Please reconnect Spotify."
        )
    
    try:
        spotify = registry.get_adapter("spotify")
        new_tokens = await spotify.refresh_token(account)
        
        for k, v in new_tokens.items():
            if hasattr(account, k) and v is not None:
                setattr(account, k, v)
        account.updated_at = datetime.utcnow()
        
        db.commit()
        return {"message": "Token refreshed successfully", "expires_at": account.expires_at}
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
    Disconnect Spotify.
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
    time_range: str = Query("medium_term", pattern="^(short_term|medium_term|long_term)$")
):
    """
    Get the user's top tracks from Spotify.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not connected")
    
    if account.expires_at and account.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    
    try:
        from app.platforms.spotify.adapter import spotify_adapter
        # Decrypt token before passing to external API
        decrypted_token = decrypt_token(account.access_token)
        tracks = await spotify_adapter.get_top_tracks(decrypted_token, limit=limit, time_range=time_range)
        return {"items": tracks, "total": len(tracks)}
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="API error")


@router.get("/top-artists")
async def get_user_top_artists(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    limit: int = Query(20, ge=1, le=50),
    time_range: str = Query("medium_term", pattern="^(short_term|medium_term|long_term)$")
):
    """
    Get the user's top artists from Spotify.
    """
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == "spotify"
    ).first()
    
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not connected")
    
    if account.expires_at and account.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    
    try:
        from app.platforms.spotify.adapter import spotify_adapter
        # Decrypt token before passing to external API
        decrypted_token = decrypt_token(account.access_token)
        artists = await spotify_adapter.get_top_artists(decrypted_token, limit=limit, time_range=time_range)
        return {"items": artists, "total": len(artists)}
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="API error")
