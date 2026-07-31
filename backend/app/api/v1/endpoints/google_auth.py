"""
Google Sign-In
===============
Lets a visitor log into (or create) a NextDrop account with their Google
identity. This is deliberately separate from app/api/v1/endpoints/youtube_auth.py:
that flow *connects* YouTube to an already-logged-in artist and needs the
youtube.readonly scope; this one only needs openid/email/profile and works
for people who don't have a session yet.
"""
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.crud import artist as artist_crud
from app.models import User
from app.sec.config import settings
from app.sec.security import create_access_token, get_password_hash

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _set_session_cookie(response: Response, user_id: int) -> None:
    access_token = create_access_token(subject=user_id)
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
    )


@router.get("/login")
def google_login():
    """Returns the Google consent-screen URL for the frontend to redirect to."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured on this server.")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": secrets.token_urlsafe(16),
    }
    return {"auth_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/callback")
async def google_callback(
    code: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(deps.get_db),
):
    """
    Exchanges the auth code for Google's identity, then either logs the
    matching NextDrop user in or creates a brand-new account for them —
    same as signing up with email, minus the password.
    """
    if error or not code:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?google=error&message={error or 'missing_code'}")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_res = await client.post(GOOGLE_TOKEN_URL, data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            })
            token_res.raise_for_status()
            google_access_token = token_res.json()["access_token"]

            userinfo_res = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
            userinfo_res.raise_for_status()
            profile = userinfo_res.json()
    except httpx.HTTPError:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?google=error&message=token_exchange_failed")

    email = profile.get("email")
    if not email:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?google=error&message=no_email")

    user = db.query(User).filter(User.email == email).first()
    if user and not user.is_active:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?google=error&message=inactive_account")

    if not user:
        user = User(
            email=email,
            full_name=profile.get("name"),
            # Google-authenticated accounts don't set a password; store an
            # unguessable random hash so the NOT NULL column stays satisfied
            # and email/password login simply can't match it.
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            is_active=True,
            is_premium=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Anyone without an artist profile yet still needs one — email signup
    # collects a stage name inline before ever reaching the dashboard; Google
    # has no equivalent step, so route them to onboarding instead of a
    # half-empty dashboard. Checked by actual artist existence (not just
    # "is this a brand-new User row") so accounts that slipped through
    # before this fix also get caught on their next Google sign-in.
    has_artist = artist_crud.get_artist_by_user_id(db, user_id=user.id) is not None
    destination = "/" if has_artist else "/onboarding"
    redirect = RedirectResponse(url=f"{settings.FRONTEND_URL}{destination}")
    _set_session_cookie(redirect, user.id)
    return redirect
