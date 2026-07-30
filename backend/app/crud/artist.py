from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Artist, Track, TrackAnalytics, ArtistApprovalStatus
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


# ── Public directory (approved artists only, ranked by real streams) ────

def _approved_artist_totals(db: Session):
    """
    One row per approved artist: total real stream count + track count,
    aggregated from track_analytics across their public (i.e. approved)
    tracks. Artists with zero public tracks still appear, with 0/0.
    """
    totals = (
        db.query(
            Track.artist_id.label("artist_id"),
            func.coalesce(func.sum(TrackAnalytics.stream_count), 0).label("total_streams"),
            func.count(func.distinct(Track.id)).label("track_count"),
        )
        .outerjoin(TrackAnalytics, TrackAnalytics.track_id == Track.id)
        .filter(Track.is_public == True)
        .group_by(Track.artist_id)
        .subquery()
    )

    return (
        db.query(
            Artist,
            func.coalesce(totals.c.total_streams, 0).label("total_streams"),
            func.coalesce(totals.c.track_count, 0).label("track_count"),
        )
        .outerjoin(totals, totals.c.artist_id == Artist.id)
        .filter(Artist.approval_status == ArtistApprovalStatus.APPROVED.value)
        .all()
    )


def get_artist_directory(db: Session, skip: int = 0, limit: int = 50):
    """
    Approved artists ranked by total real stream count (desc). Rank is
    computed over the full approved-artist set, then the page is sliced —
    so rank #1 always means #1 platform-wide, not #1-on-this-page.

    Dataset is small enough (per-artist scale, not per-listener) to rank
    in Python rather than with a SQL window function.
    """
    rows = _approved_artist_totals(db)
    ranked = sorted(rows, key=lambda r: (-int(r.total_streams or 0), r.Artist.id))
    total = len(ranked)
    entries = [
        {
            "artist": r.Artist,
            "rank": idx + 1,
            "track_count": int(r.track_count or 0),
            "total_streams": int(r.total_streams or 0),
        }
        for idx, r in enumerate(ranked)
    ]
    return entries[skip: skip + limit], total


def get_artist_profile(db: Session, artist_id: int):
    """A single approved artist's public profile, with rank over the full directory."""
    entries, _ = get_artist_directory(db, skip=0, limit=100_000)
    for entry in entries:
        if entry["artist"].id == artist_id:
            return entry
    return None
