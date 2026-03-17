from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Album, AlbumTrack, Track
from app.schemas.album import AlbumCreate, AlbumTrackLink

def get_album_by_id(db: Session, album_id: int):
    return db.query(Album).filter(Album.id == album_id).first()

def get_albums_by_artist(db: Session, artist_id: int, skip: int = 0, limit: int = 100):
    return db.query(Album).filter(Album.artist_id == artist_id).offset(skip).limit(limit).all()

def count_albums_by_artist(db: Session, artist_id: int) -> int:
    return db.query(func.count(Album.id)).filter(Album.artist_id == artist_id).scalar()

def create_album(db: Session, album_in: AlbumCreate, artist_id: int):
    db_album = Album(
        artist_id=artist_id,
        title=album_in.title,
        cover_art_url=album_in.cover_art_url
    )
    db.add(db_album)
    db.commit()
    db.refresh(db_album)
    return db_album

def link_track_to_album(db: Session, album_id: int, track_id: int, position: int = 1):
    # Check if link already exists
    existing = db.query(AlbumTrack).filter(
        AlbumTrack.album_id == album_id,
        AlbumTrack.track_id == track_id
    ).first()
    
    if existing:
        existing.position = position
        db.commit()
        db.refresh(existing)
        return existing
    
    db_link = AlbumTrack(
        album_id=album_id,
        track_id=track_id,
        position=position
    )
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link

def get_album_tracks(db: Session, album_id: int):
    """Get all tracks in an album with their positions."""
    results = db.query(Track, AlbumTrack.position).join(
        AlbumTrack, Track.id == AlbumTrack.track_id
    ).filter(
        AlbumTrack.album_id == album_id
    ).order_by(AlbumTrack.position).all()
    
    return [{"track": track, "position": pos} for track, pos in results]

def delete_album(db: Session, album: Album):
    db.delete(album)
    db.commit()
    return album
