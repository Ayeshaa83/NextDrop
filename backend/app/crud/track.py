from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Track
from app.schemas.track import TrackCreate, TrackUpdate

def get_track_by_id(db: Session, track_id: int):
    return db.query(Track).filter(Track.id == track_id).first()

def get_tracks_by_artist(db: Session, artist_id: int, skip: int = 0, limit: int = 100):
    return db.query(Track).filter(Track.artist_id == artist_id).offset(skip).limit(limit).all()

def count_tracks_by_artist(db: Session, artist_id: int) -> int:
    return db.query(func.count(Track.id)).filter(Track.artist_id == artist_id).scalar()

def get_all_public_tracks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Track).filter(Track.is_public == True).offset(skip).limit(limit).all()

def count_public_tracks(db: Session) -> int:
    return db.query(func.count(Track.id)).filter(Track.is_public == True).scalar()

def create_track(db: Session, track_in: TrackCreate, artist_id: int):
    db_track = Track(
        artist_id=artist_id,
        title=track_in.title,
        duration=track_in.duration,
        file_url=track_in.file_url,
        genre=track_in.genre,
        bpm=track_in.bpm,
        is_public=track_in.is_public
    )
    db.add(db_track)
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
