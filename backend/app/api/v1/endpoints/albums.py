from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.crud import album as album_crud
from app.crud import artist as artist_crud
from app.crud import track as track_crud
from app.schemas.album import AlbumCreate, AlbumResponse, AlbumTrackLink
from app.models import User

router = APIRouter()

def get_current_artist_id(db: Session, current_user: User):
    """Helper to get artist ID from current user."""
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=400,
            detail="You need to create an artist profile first"
        )
    return artist.id

@router.post("/", response_model=AlbumResponse, status_code=status.HTTP_201_CREATED)
def create_album(
    album_in: AlbumCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Create a new album."""
    artist_id = get_current_artist_id(db, current_user)
    return album_crud.create_album(db, album_in=album_in, artist_id=artist_id)

@router.get("/", response_model=PaginatedResponse[AlbumResponse])
def list_my_albums(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """List all albums for the current artist with pagination."""
    artist_id = get_current_artist_id(db, current_user)
    items = album_crud.get_albums_by_artist(db, artist_id=artist_id, skip=pagination.skip, limit=pagination.limit)
    total = album_crud.count_albums_by_artist(db, artist_id=artist_id)
    return paginate(items, total, pagination.skip, pagination.limit)

@router.get("/{album_id}", response_model=AlbumResponse)
def get_album(
    album_id: int,
    db: Session = Depends(deps.get_db)
):
    """Get a specific album by ID."""
    album = album_crud.get_album_by_id(db, album_id=album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album

@router.post("/{album_id}/tracks", status_code=status.HTTP_201_CREATED)
def link_track_to_album(
    album_id: int,
    link_data: AlbumTrackLink,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Link a track to an album."""
    artist_id = get_current_artist_id(db, current_user)
    
    # Verify album ownership
    album = album_crud.get_album_by_id(db, album_id=album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    if album.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this album")
    
    # Verify track ownership
    track = track_crud.get_track_by_id(db, track_id=link_data.track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="You can only add your own tracks to your album")
    
    album_crud.link_track_to_album(
        db, 
        album_id=album_id, 
        track_id=link_data.track_id, 
        position=link_data.position
    )
    return {"message": "Track linked to album successfully", "position": link_data.position}

@router.get("/{album_id}/tracks")
def get_album_tracks(
    album_id: int,
    db: Session = Depends(deps.get_db)
):
    """Get all tracks in an album."""
    album = album_crud.get_album_by_id(db, album_id=album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    tracks_data = album_crud.get_album_tracks(db, album_id=album_id)
    return {
        "album_id": album_id,
        "album_title": album.title,
        "tracks": [
            {
                "id": item["track"].id,
                "title": item["track"].title,
                "duration": item["track"].duration,
                "position": item["position"]
            }
            for item in tracks_data
        ]
    }

@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_album(
    album_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Delete an album (only by owner)."""
    artist_id = get_current_artist_id(db, current_user)
    album = album_crud.get_album_by_id(db, album_id=album_id)
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    if album.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this album")
    
    album_crud.delete_album(db, album=album)
    return None
