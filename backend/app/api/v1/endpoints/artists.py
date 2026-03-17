from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.crud import artist as artist_crud
from app.schemas.artist import ArtistCreate, ArtistUpdate, ArtistResponse
from app.models import User

router = APIRouter()

@router.post("/", response_model=ArtistResponse, status_code=status.HTTP_201_CREATED)
def create_artist_profile(
    artist_in: ArtistCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Create an artist profile for the current user."""
    # Check if user already has an artist profile
    existing = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Artist profile already exists for this user"
        )
    
    return artist_crud.create_artist(db, artist_in=artist_in, user_id=current_user.id)

@router.get("/me", response_model=ArtistResponse)
def get_my_artist_profile(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get the current user's artist profile."""
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=404,
            detail="Artist profile not found. Please create one first."
        )
    return artist

@router.put("/me", response_model=ArtistResponse)
def update_my_artist_profile(
    artist_in: ArtistUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Update the current user's artist profile."""
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=404,
            detail="Artist profile not found"
        )
    return artist_crud.update_artist(db, artist=artist, artist_in=artist_in)

@router.get("/", response_model=PaginatedResponse[ArtistResponse])
def list_artists(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db)
):
    """List all artists (public endpoint) with pagination."""
    items = artist_crud.get_all_artists(db, skip=pagination.skip, limit=pagination.limit)
    total = artist_crud.count_artists(db)
    return paginate(items, total, pagination.skip, pagination.limit)

@router.get("/{artist_id}", response_model=ArtistResponse)
def get_artist(
    artist_id: int,
    db: Session = Depends(deps.get_db)
):
    """Get a specific artist by ID."""
    artist = artist_crud.get_artist_by_id(db, artist_id=artist_id)
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    return artist
