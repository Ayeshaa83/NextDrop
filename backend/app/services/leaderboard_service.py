"""
Leaderboard scoring — computed live from real activity, not a stored table
someone has to remember to keep in sync.

Previously the `leaderboard` table was populated once by the seed script and
never touched again: publishing a track, gaining streams, or landing a
collaboration had no effect on anyone's rank, and any artist created after
seeding (i.e. every real signup) simply had no row and could never appear.
Computing on read means a track's rank reflects its current real data the
moment you look, with no write-path anyone could forget to wire up.

Only artists with a nonzero score in a category are considered "ranked" —
having an account isn't enough; you need real activity in that category.
This matches the frontend's existing "Unranked — release music to enter the
rankings" copy, which described intended behavior that never actually
existed until now.
"""
import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Artist, Track, TrackAnalytics, AnalyticsSnapshot, Collaboration,
)

CATEGORIES = [
    "Top Tracks",
    "Viral Producers",
    "Most Collaborative",
    "Rising Stars",
    "Open Verse Champions",
]

# How far back "recent" reaches for the Rising Stars window.
RISING_STARS_WINDOW_DAYS = 30


def _lifetime_streams_by_artist(db: Session) -> dict[int, int]:
    """Top Tracks — total streams across an artist's whole catalog."""
    rows = (
        db.query(Track.artist_id, func.coalesce(func.sum(TrackAnalytics.stream_count), 0))
        .join(TrackAnalytics, TrackAnalytics.track_id == Track.id)
        .group_by(Track.artist_id)
        .all()
    )
    return {artist_id: int(total) for artist_id, total in rows}


def _viral_velocity_by_artist(db: Session) -> dict[int, int]:
    """Viral Producers — summed viral_velocity across an artist's tracks."""
    rows = (
        db.query(Track.artist_id, func.coalesce(func.sum(TrackAnalytics.viral_velocity), 0))
        .join(TrackAnalytics, TrackAnalytics.track_id == Track.id)
        .group_by(Track.artist_id)
        .all()
    )
    return {artist_id: round(total) for artist_id, total in rows}


def _collab_counts_by_artist(db: Session, *, open_verse_only: bool) -> dict[int, int]:
    """
    Shared by Most Collaborative and Open Verse Champions — counts accepted
    or completed collaborations an artist is party to, either as the one who
    reached out or the one who was asked. open_verse_only restricts this to
    collaborations that originated from an Open Verse post specifically,
    rather than a direct request, so the two categories measure different
    things instead of duplicating each other.
    """
    statuses = ["accepted", "completed"]
    query = db.query(Collaboration).filter(Collaboration.status.in_(statuses))
    if open_verse_only:
        query = query.filter(Collaboration.post_id.isnot(None))

    counts: dict[int, int] = {}
    for collab in query.all():
        counts[collab.initiator_id] = counts.get(collab.initiator_id, 0) + 1
        counts[collab.collaborator_id] = counts.get(collab.collaborator_id, 0) + 1
    return counts


def _recent_streams_by_artist(db: Session, since: datetime.date) -> dict[int, int]:
    """Rising Stars — streams in the last RISING_STARS_WINDOW_DAYS days, so
    this rewards current momentum rather than lifetime totals (that's what
    Top Tracks already measures)."""
    rows = (
        db.query(Track.artist_id, func.coalesce(func.sum(AnalyticsSnapshot.streams), 0))
        .join(AnalyticsSnapshot, AnalyticsSnapshot.track_id == Track.id)
        .filter(AnalyticsSnapshot.snapshot_date >= since)
        .group_by(Track.artist_id)
        .all()
    )
    return {artist_id: int(total) for artist_id, total in rows}


def _scores_for_category(db: Session, category: str) -> dict[int, int]:
    if category == "Top Tracks":
        return _lifetime_streams_by_artist(db)
    if category == "Viral Producers":
        return _viral_velocity_by_artist(db)
    if category == "Most Collaborative":
        return _collab_counts_by_artist(db, open_verse_only=False)
    if category == "Rising Stars":
        since = datetime.date.today() - datetime.timedelta(days=RISING_STARS_WINDOW_DAYS)
        return _recent_streams_by_artist(db, since)
    if category == "Open Verse Champions":
        return _collab_counts_by_artist(db, open_verse_only=True)
    return {}


def compute_ranked_artists(db: Session, category: str) -> list[tuple[Artist, int]]:
    """
    Returns (artist, points) pairs for every artist with a nonzero score in
    this category, sorted by points descending (ties broken by artist id for
    a stable order). Position in this list — 1-indexed — is the artist's
    rank; callers paginate this after ranking, not before, so rank always
    reflects full standing regardless of the page requested.
    """
    scores = _scores_for_category(db, category)
    ranked_ids = sorted(
        (aid for aid, pts in scores.items() if pts > 0),
        key=lambda aid: (-scores[aid], aid),
    )
    if not ranked_ids:
        return []

    artists = {a.id: a for a in db.query(Artist).filter(Artist.id.in_(ranked_ids)).all()}
    return [(artists[aid], scores[aid]) for aid in ranked_ids if aid in artists]


def get_artist_rank(db: Session, artist_id: int, category: str) -> Optional[tuple[int, int]]:
    """Returns (rank, points) for one artist in one category, or None if
    they have no activity there yet (i.e. they're unranked)."""
    ranked = compute_ranked_artists(db, category)
    for i, (artist, points) in enumerate(ranked, start=1):
        if artist.id == artist_id:
            return i, points
    return None
