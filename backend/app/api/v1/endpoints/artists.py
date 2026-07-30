from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.crud import artist as artist_crud
from app.crud import track as track_crud
from app.schemas.artist import ArtistCreate, ArtistUpdate, ArtistResponse, ArtistPublicProfile
from app.schemas.track import PublicTrackResponse
from app.models import User, TrackAnalytics

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


def _to_public_profile(entry: dict) -> ArtistPublicProfile:
    a = entry["artist"]
    return ArtistPublicProfile(
        id=a.id,
        user_id=a.user_id,
        stage_name=a.stage_name,
        bio=a.bio,
        profile_picture=a.profile_picture,
        is_verified=a.is_verified,
        rank=entry["rank"],
        track_count=entry["track_count"],
        total_streams=entry["total_streams"],
    )


@router.get("/", response_model=PaginatedResponse[ArtistPublicProfile])
def list_artists(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db)
):
    """
    Public artist directory (Explore page): approved artists only,
    ranked by real total stream count across their public tracks.
    """
    entries, total = artist_crud.get_artist_directory(db, skip=pagination.skip, limit=pagination.limit)
    items = [_to_public_profile(e) for e in entries]
    return paginate(items, total, pagination.skip, pagination.limit)


@router.get("/{artist_id}", response_model=ArtistPublicProfile)
def get_artist(
    artist_id: int,
    db: Session = Depends(deps.get_db)
):
    """Get a specific approved artist's public profile by ID, with rank."""
    entry = artist_crud.get_artist_profile(db, artist_id=artist_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Artist not found")
    return _to_public_profile(entry)


@router.get("/{artist_id}/tracks", response_model=PaginatedResponse[PublicTrackResponse])
def get_artist_tracks(
    artist_id: int,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
):
    """Public track list for an artist's profile page (approved + public only)."""
    entry = artist_crud.get_artist_profile(db, artist_id=artist_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Artist not found")

    tracks = track_crud.get_public_tracks_by_artist(
        db, artist_id=artist_id, skip=pagination.skip, limit=pagination.limit
    )
    total = track_crud.count_public_tracks_by_artist(db, artist_id=artist_id)

    stream_counts: dict[int, int] = {}
    track_ids = [t.id for t in tracks]
    if track_ids:
        rows = (
            db.query(TrackAnalytics.track_id, TrackAnalytics.stream_count)
            .filter(TrackAnalytics.track_id.in_(track_ids))
            .all()
        )
        stream_counts = {tid: (sc or 0) for tid, sc in rows}

    items = [
        PublicTrackResponse(
            id=t.id,
            title=t.title,
            duration=t.duration,
            file_url=t.file_url,
            cover_art_url=t.cover_art_url,
            genre=t.genre,
            bpm=t.bpm,
            is_explicit=t.is_explicit,
            created_at=t.created_at,
            stream_count=stream_counts.get(t.id, 0),
        )
        for t in tracks
    ]
    return paginate(items, total, pagination.skip, pagination.limit)
