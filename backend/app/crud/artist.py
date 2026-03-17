from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Artist
from app.schemas.artist import ArtistCreate, ArtistUpdate

def get_artist_by_user_id(db: Session, user_id: int):
    return db.query(Artist).filter(Artist.user_id == user_id).first()

def get_artist_by_id(db: Session, artist_id: int):
    return db.query(Artist).filter(Artist.id == artist_id).first()

def get_all_artists(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Artist).offset(skip).limit(limit).all()

def count_artists(db: Session) -> int:
    return db.query(func.count(Artist.id)).scalar()

def create_artist(db: Session, artist_in: ArtistCreate, user_id: int):
    db_artist = Artist(
        user_id=user_id,
        stage_name=artist_in.stage_name,
        bio=artist_in.bio,
        profile_picture=artist_in.profile_picture
    )
    db.add(db_artist)
    db.commit()
    db.refresh(db_artist)
    return db_artist

def update_artist(db: Session, artist: Artist, artist_in: ArtistUpdate):
    update_data = artist_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(artist, field, value)
    db.add(artist)
    db.commit()
    db.refresh(artist)
    return artist
