from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.models import Collaboration, Leaderboard, Artist, CollabMessage
from app.models.social import CollaborationStatus
from app.schemas.social import CollaborationCreate, LeaderboardEntry

def _with_relations(query):
    return query.options(
        joinedload(Collaboration.initiator),
        joinedload(Collaboration.collaborator),
        joinedload(Collaboration.track),
    )

def create_collaboration(db: Session, collab_in: CollaborationCreate, initiator_id: int):
    db_collab = Collaboration(
        initiator_id=initiator_id,
        collaborator_id=collab_in.collaborator_id,
        track_id=collab_in.track_id,
        message=collab_in.message,
        status=CollaborationStatus.PENDING
    )
    db.add(db_collab)
    db.commit()
    db.refresh(db_collab)
    return get_collaboration_by_id(db, db_collab.id)

def get_collaboration_by_id(db: Session, collab_id: int):
    return _with_relations(db.query(Collaboration)).filter(Collaboration.id == collab_id).first()

def get_collaborations_for_artist(db: Session, artist_id: int, skip: int = 0, limit: int = 50):
    """Get collaborations where artist is either initiator or collaborator."""
    return (
        _with_relations(db.query(Collaboration))
        .filter((Collaboration.initiator_id == artist_id) | (Collaboration.collaborator_id == artist_id))
        .order_by(Collaboration.updated_at.desc())
        .offset(skip).limit(limit).all()
    )

def count_collaborations_for_artist(db: Session, artist_id: int) -> int:
    """Count collaborations for an artist."""
    return db.query(func.count(Collaboration.id)).filter(
        (Collaboration.initiator_id == artist_id) | (Collaboration.collaborator_id == artist_id)
    ).scalar()

def get_pending_collaborations(db: Session, artist_id: int, skip: int = 0, limit: int = 50):
    """Get pending collaboration requests for an artist."""
    return (
        _with_relations(db.query(Collaboration))
        .filter(Collaboration.collaborator_id == artist_id, Collaboration.status == CollaborationStatus.PENDING)
        .order_by(Collaboration.created_at.desc())
        .offset(skip).limit(limit).all()
    )

def count_pending_collaborations(db: Session, artist_id: int) -> int:
    """Count pending collaboration requests."""
    return db.query(func.count(Collaboration.id)).filter(
        Collaboration.collaborator_id == artist_id,
        Collaboration.status == CollaborationStatus.PENDING
    ).scalar()

def update_collaboration_status(db: Session, collab: Collaboration, status: CollaborationStatus):
    collab.status = status
    db.commit()
    db.refresh(collab)
    return get_collaboration_by_id(db, collab.id)

def set_collaboration_track(db: Session, collab: Collaboration, track_id: int):
    """Attach (or replace) the finished track for a collaboration, once the artists have accepted."""
    collab.track_id = track_id
    db.commit()
    db.refresh(collab)
    return get_collaboration_by_id(db, collab.id)


# ── Collab chat messages ─────────────────────────────────────────────────

def create_collab_message(db: Session, collaboration_id: int, sender_id: int, content: str):
    msg = CollabMessage(collaboration_id=collaboration_id, sender_id=sender_id, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_collab_messages(db: Session, collaboration_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(CollabMessage)
        .filter(CollabMessage.collaboration_id == collaboration_id)
        .order_by(CollabMessage.created_at.asc())
        .offset(skip).limit(limit).all()
    )

def count_collab_messages(db: Session, collaboration_id: int) -> int:
    return db.query(func.count(CollabMessage.id)).filter(
        CollabMessage.collaboration_id == collaboration_id
    ).scalar()

def mark_collab_messages_read(db: Session, collaboration_id: int, reader_user_id: int):
    """Mark every message in this thread NOT sent by the reader as read."""
    db.query(CollabMessage).filter(
        CollabMessage.collaboration_id == collaboration_id,
        CollabMessage.sender_id != reader_user_id,
        CollabMessage.read_at.is_(None),
    ).update({"read_at": func.now()})
    db.commit()

def get_unread_message_count_for_collab(db: Session, collaboration_id: int, reader_user_id: int) -> int:
    return db.query(func.count(CollabMessage.id)).filter(
        CollabMessage.collaboration_id == collaboration_id,
        CollabMessage.sender_id != reader_user_id,
        CollabMessage.read_at.is_(None),
    ).scalar()

def get_unread_message_count_for_artist(db: Session, artist_id: int, user_id: int) -> int:
    """Total unread messages across every collaboration this artist is part of — for the Sidebar badge."""
    return (
        db.query(func.count(CollabMessage.id))
        .join(Collaboration, Collaboration.id == CollabMessage.collaboration_id)
        .filter(
            (Collaboration.initiator_id == artist_id) | (Collaboration.collaborator_id == artist_id),
            CollabMessage.sender_id != user_id,
            CollabMessage.read_at.is_(None),
        )
        .scalar()
    )


def get_leaderboard(db: Session, category: str = None, skip: int = 0, limit: int = 50):
    query = db.query(Leaderboard, Artist).join(Artist, Leaderboard.artist_id == Artist.id)

    if category:
        query = query.filter(Leaderboard.category == category)

    results = query.order_by(Leaderboard.rank).offset(skip).limit(limit).all()

    return [
        LeaderboardEntry(
            rank=lb.rank,
            artist_id=lb.artist_id,
            stage_name=artist.stage_name,
            points=lb.points,
            profile_picture=artist.profile_picture
        )
        for lb, artist in results
    ]

def count_leaderboard_entries(db: Session, category: str = None) -> int:
    """Count leaderboard entries."""
    query = db.query(func.count(Leaderboard.id))
    if category:
        query = query.filter(Leaderboard.category == category)
    return query.scalar()

def update_leaderboard_entry(db: Session, artist_id: int, category: str, points: int, rank: int):
    existing = db.query(Leaderboard).filter(
        Leaderboard.artist_id == artist_id,
        Leaderboard.category == category
    ).first()

    if existing:
        existing.points = points
        existing.rank = rank
    else:
        existing = Leaderboard(
            artist_id=artist_id,
            category=category,
            points=points,
            rank=rank
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return existing
