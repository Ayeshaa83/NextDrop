import datetime

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models import Track, TrackCollaborator, User
from app.schemas.track import TrackCreate, TrackUpdate

def get_track_by_id(db: Session, track_id: int):
    return db.query(Track).filter(Track.id == track_id).first()

def get_tracks_by_artist(db: Session, artist_id: int, skip: int = 0, limit: int = 100):
    # Newest first — without an explicit order, Postgres makes no guarantee
    # about row order, which left the dashboard's "Now Tracking" headline
    # (myTracks[0]) showing an effectively arbitrary track.
    return (
        db.query(Track)
        .filter(Track.artist_id == artist_id)
        .order_by(Track.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def count_tracks_by_artist(db: Session, artist_id: int) -> int:
    return db.query(func.count(Track.id)).filter(Track.artist_id == artist_id).scalar()

def _released_filter():
    """Scheduled tracks stay hidden from public listings until release_date."""
    return or_(Track.release_date.is_(None), Track.release_date <= datetime.datetime.utcnow())

def get_all_public_tracks(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(Track)
        .filter(Track.is_public == True, _released_filter())
        .order_by(Track.created_at.desc())
        .offset(skip).limit(limit).all()
    )

def count_public_tracks(db: Session) -> int:
    return (
        db.query(func.count(Track.id))
        .filter(Track.is_public == True, _released_filter())
        .scalar()
    )

def get_public_tracks_by_artist(db: Session, artist_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(Track)
        .filter(Track.artist_id == artist_id, Track.is_public == True, _released_filter())
        .order_by(Track.created_at.desc())
        .offset(skip).limit(limit).all()
    )

def count_public_tracks_by_artist(db: Session, artist_id: int) -> int:
    return (
        db.query(func.count(Track.id))
        .filter(Track.artist_id == artist_id, Track.is_public == True, _released_filter())
        .scalar()
    )

from app.services.isrc_generator import generate_next_isrc

def create_track(db: Session, track_in: TrackCreate, artist_id: int):
    isrc_value = track_in.isrc.strip() if track_in.isrc and track_in.isrc.strip() else generate_next_isrc(db)

    db_track = Track(
        artist_id=artist_id,
        title=track_in.title,
        duration=track_in.duration,
        file_url=track_in.file_url,
        cover_art_url=track_in.cover_art_url,
        genre=track_in.genre,
        bpm=track_in.bpm,
        is_public=track_in.is_public,
        isrc=isrc_value,
        is_explicit=track_in.is_explicit,
        release_date=track_in.release_date,
    )
    db.add(db_track)
    db.flush()  # Assign track id before creating split-sheet rows

    # Persist the split sheet. Names matching a registered user's artist
    # email get linked; everyone else is stored by display name only.
    for collab in track_in.collaborators:
        user = db.query(User).filter(User.email == collab.name).first()
        db.add(TrackCollaborator(
            track_id=db_track.id,
            user_id=user.id if user else None,
            display_name=collab.name,
            role=collab.role,
            royalty_percentage=collab.royalty_percentage,
        ))

    db.commit()
    db.refresh(db_track)
    return db_track

def update_track(db: Session, track: Track, track_in: TrackUpdate):
    update_data = track_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(track, field, value)
    db.add(track)
    db.commit()
    db.refresh(track)
    return track

def delete_track(db: Session, track: Track):
    db.delete(track)
    db.commit()
    return track
