from datetime import timedelta
from typing import Any
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, EmailStr, Field
from app.api import deps
from app.crud import user as user_crud
from app.schemas.user import UserCreate, UserResponse
from app.schemas.token import Token
from app.sec.security import (
    create_access_token, verify_password, get_password_hash,
    create_password_reset_token, verify_password_reset_token,
)
from app.sec.config import settings
from app.sec.rate_limiter import limiter
from app.services import email_service

router = APIRouter()

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def signup(request: Request, user_in: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(deps.get_db)):
    try:
        # 1. Check if user already exists
        user = user_crud.get_user_by_email(db, email=user_in.email)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please try again shortly.",
        )

    if user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists in NextDrop."
        )
    
    # 2. Create the user
    try:
        new_user = user_crud.create_user(db, user_in=user_in)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please try again shortly.",
        )

    subject, html = email_service.welcome_email(new_user.email)
    background_tasks.add_task(email_service.send, new_user.email, subject, html)

    return new_user

@router.post("/login/access-token", response_model=Token)
@limiter.limit("10/minute")
def login_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    Sets HttpOnly cookie for secure browser authentication.

    When remember_me is set, both the JWT and the cookie live for
    settings.REMEMBER_ME_EXPIRE_DAYS instead of the short default session.
    """
    try:
        # 1. Authenticate
        user = user_crud.get_user_by_email(db, email=form_data.username)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please try again shortly.",
        )

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # 2. Create JWT
    if remember_me:
        expires_delta = timedelta(days=settings.REMEMBER_ME_EXPIRE_DAYS)
        max_age = int(expires_delta.total_seconds())
    else:
        expires_delta = None
        max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    access_token = create_access_token(subject=user.id, expires_delta=expires_delta)

    # 3. Set HttpOnly cookie
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=access_token,
        max_age=max_age,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
    )

    # 4. Also return token in response body (for backwards compatibility)
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(response: Response):
    """
    Logout user by clearing the HttpOnly auth cookie.
    """
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
    )
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user = Depends(deps.get_current_active_user)
):
    """
    Get current authenticated user info.
    Used by frontend to check auth status when using HttpOnly cookies.
    """
    return current_user


# ──── Password Reset ────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    req: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
):
    """
    Send a password-reset link. Always responds with the same message so
    email addresses can't be enumerated.
    """
    user = user_crud.get_user_by_email(db, email=req.email)
    if user and user.is_active:
        token = create_password_reset_token(user.id)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        subject, html = email_service.password_reset_email(user.email, reset_url)
        background_tasks.add_task(email_service.send, user.email, subject, html)

    return {"message": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(
    request: Request,
    req: ResetPasswordRequest,
    db: Session = Depends(deps.get_db),
):
    """Set a new password using the token from the reset email."""
    user_id = verify_password_reset_token(req.token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )

    from app.models import User
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account not found.")

    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password updated. You can now log in with your new password."}