from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Collaboration, Leaderboard, Artist
from app.models.social import CollaborationStatus
from app.schemas.social import CollaborationCreate, LeaderboardEntry

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
    return db_collab

def get_collaboration_by_id(db: Session, collab_id: int):
    return db.query(Collaboration).filter(Collaboration.id == collab_id).first()

def get_collaborations_for_artist(db: Session, artist_id: int, skip: int = 0, limit: int = 50):
    """Get collaborations where artist is either initiator or collaborator."""
    return db.query(Collaboration).filter(
        (Collaboration.initiator_id == artist_id) | (Collaboration.collaborator_id == artist_id)
    ).offset(skip).limit(limit).all()

def count_collaborations_for_artist(db: Session, artist_id: int) -> int:
    """Count collaborations for an artist."""
    return db.query(func.count(Collaboration.id)).filter(
        (Collaboration.initiator_id == artist_id) | (Collaboration.collaborator_id == artist_id)
    ).scalar()

def get_pending_collaborations(db: Session, artist_id: int, skip: int = 0, limit: int = 50):
    """Get pending collaboration requests for an artist."""
    return db.query(Collaboration).filter(
        Collaboration.collaborator_id == artist_id,
        Collaboration.status == CollaborationStatus.PENDING
    ).offset(skip).limit(limit).all()

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
    return collab

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
