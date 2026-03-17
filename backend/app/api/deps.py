from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.sec.config import settings
from app.models import User, Artist, UserRole

# OAuth2 scheme for Bearer token (optional - allows both cookie and header auth)
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login/access-token",
    auto_error=False  # Don't auto-raise, we'll check cookie as fallback
)

def get_db() -> Generator:
    db = SessionLocal()  
    try:
        yield db
    finally:
        db.close()


def get_token_from_request(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme)
) -> str:
    """
    Extract JWT from either:
    1. Authorization Bearer header (for API clients)
    2. HttpOnly cookie (for browser clients)
    
    Priority: Bearer header > Cookie
    """
    # First, try Bearer token from header
    if bearer_token:
        return bearer_token
    
    # Fallback to HttpOnly cookie
    cookie_token = request.cookies.get(settings.COOKIE_NAME)
    if cookie_token:
        return cookie_token
    
    # No token found
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(get_token_from_request)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_current_artist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Artist:
    """
    Get the artist profile associated with the current user.
    Raises 400 if user doesn't have an artist profile.
    """
    artist = db.query(Artist).filter(Artist.user_id == current_user.id).first()
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You need to create an artist profile first"
        )
    return artist


def get_current_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Verify the current user has ADMIN role.
    Raises 403 if user is not an admin.
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges"
        )
    return current_user