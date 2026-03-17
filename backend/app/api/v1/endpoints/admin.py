"""
Admin API Endpoints
Handles track approvals, plagiarism checks, and system administration.
All routes require ADMIN role.
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.models import User, Track, ApprovalStatus


router = APIRouter()


# ============ SCHEMAS ============

class TrackApprovalResponse(BaseModel):
    id: int
    title: str
    artist_id: int
    artist_name: Optional[str] = None
    file_url: str
    genre: Optional[str] = None
    approval_status: str
    approval_notes: Optional[str] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApprovalAction(BaseModel):
    status: str  # "approved" or "rejected"
    notes: Optional[str] = None


class AdminStats(BaseModel):
    total_users: int
    total_artists: int
    total_tracks: int
    pending_approvals: int
    approved_tracks: int
    rejected_tracks: int


# ============ ENDPOINTS ============

@router.get("/stats", response_model=AdminStats)
def get_admin_stats(
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Get platform-wide statistics for admin dashboard."""
    from app.models import Artist
    
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_artists = db.query(func.count(Artist.id)).scalar() or 0
    total_tracks = db.query(func.count(Track.id)).scalar() or 0
    
    pending = db.query(func.count(Track.id)).filter(
        Track.approval_status == ApprovalStatus.PENDING.value
    ).scalar() or 0
    
    approved = db.query(func.count(Track.id)).filter(
        Track.approval_status == ApprovalStatus.APPROVED.value
    ).scalar() or 0
    
    rejected = db.query(func.count(Track.id)).filter(
        Track.approval_status == ApprovalStatus.REJECTED.value
    ).scalar() or 0
    
    return AdminStats(
        total_users=total_users,
        total_artists=total_artists,
        total_tracks=total_tracks,
        pending_approvals=pending,
        approved_tracks=approved,
        rejected_tracks=rejected
    )


@router.get("/tracks/pending", response_model=PaginatedResponse[TrackApprovalResponse])
def get_pending_tracks(
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin),
    pagination: PaginationParams = Depends()
):
    """
    Get all tracks pending admin approval.
    Used for plagiarism checks and content moderation.
    """
    from app.models import Artist
    
    query = db.query(Track).filter(
        Track.approval_status == ApprovalStatus.PENDING.value
    ).order_by(Track.id.desc())
    
    total = query.count()
    tracks = query.offset(pagination.skip).limit(pagination.limit).all()
    
    # Enrich with artist names
    items = []
    for track in tracks:
        artist = db.query(Artist).filter(Artist.id == track.artist_id).first()
        item = TrackApprovalResponse(
            id=track.id,
            title=track.title,
            artist_id=track.artist_id,
            artist_name=artist.stage_name if artist else None,
            file_url=track.file_url,
            genre=track.genre,
            approval_status=track.approval_status,
            approval_notes=track.approval_notes,
            approved_by_id=track.approved_by_id,
            approved_at=track.approved_at,
            created_at=None  # Track model doesn't have created_at yet
        )
        items.append(item)
    
    return paginate(items, total, pagination)


@router.get("/tracks/all", response_model=PaginatedResponse[TrackApprovalResponse])
def get_all_tracks_admin(
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin),
    pagination: PaginationParams = Depends(),
    status_filter: Optional[str] = Query(None, description="Filter by approval status")
):
    """Get all tracks with optional status filter (admin view)."""
    from app.models import Artist
    
    query = db.query(Track)
    
    if status_filter:
        query = query.filter(Track.approval_status == status_filter)
    
    query = query.order_by(Track.id.desc())
    total = query.count()
    tracks = query.offset(pagination.skip).limit(pagination.limit).all()
    
    items = []
    for track in tracks:
        artist = db.query(Artist).filter(Artist.id == track.artist_id).first()
        item = TrackApprovalResponse(
            id=track.id,
            title=track.title,
            artist_id=track.artist_id,
            artist_name=artist.stage_name if artist else None,
            file_url=track.file_url,
            genre=track.genre,
            approval_status=track.approval_status,
            approval_notes=track.approval_notes,
            approved_by_id=track.approved_by_id,
            approved_at=track.approved_at,
            created_at=None
        )
        items.append(item)
    
    return paginate(items, total, pagination)


@router.put("/tracks/{track_id}/approve", response_model=TrackApprovalResponse)
def approve_track(
    track_id: int,
    action: ApprovalAction,
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """
    Approve or reject a track.
    
    - status: "approved" or "rejected"
    - notes: Optional admin notes (e.g., rejection reason)
    """
    from app.models import Artist
    
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Validate status
    if action.status not in [ApprovalStatus.APPROVED.value, ApprovalStatus.REJECTED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'approved' or 'rejected'"
        )
    
    # Update track
    track.approval_status = action.status
    track.approval_notes = action.notes
    track.approved_by_id = admin.id
    track.approved_at = datetime.utcnow()
    
    # If approved, also make it public
    if action.status == ApprovalStatus.APPROVED.value:
        track.is_public = True
    
    db.commit()
    db.refresh(track)
    
    artist = db.query(Artist).filter(Artist.id == track.artist_id).first()
    
    return TrackApprovalResponse(
        id=track.id,
        title=track.title,
        artist_id=track.artist_id,
        artist_name=artist.stage_name if artist else None,
        file_url=track.file_url,
        genre=track.genre,
        approval_status=track.approval_status,
        approval_notes=track.approval_notes,
        approved_by_id=track.approved_by_id,
        approved_at=track.approved_at,
        created_at=None
    )


@router.put("/tracks/{track_id}/review", response_model=TrackApprovalResponse)
def mark_under_review(
    track_id: int,
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Mark a track as under review (admin is actively reviewing)."""
    from app.models import Artist
    
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    track.approval_status = ApprovalStatus.UNDER_REVIEW.value
    db.commit()
    db.refresh(track)
    
    artist = db.query(Artist).filter(Artist.id == track.artist_id).first()
    
    return TrackApprovalResponse(
        id=track.id,
        title=track.title,
        artist_id=track.artist_id,
        artist_name=artist.stage_name if artist else None,
        file_url=track.file_url,
        genre=track.genre,
        approval_status=track.approval_status,
        approval_notes=track.approval_notes,
        approved_by_id=track.approved_by_id,
        approved_at=track.approved_at,
        created_at=None
    )


@router.get("/users", response_model=PaginatedResponse)
def get_all_users(
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin),
    pagination: PaginationParams = Depends(),
    role_filter: Optional[str] = Query(None, description="Filter by role")
):
    """Get all users (admin only)."""
    query = db.query(User)
    
    if role_filter:
        query = query.filter(User.role == role_filter)
    
    total = query.count()
    users = query.offset(pagination.skip).limit(pagination.limit).all()
    
    items = [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "is_premium": u.is_premium,
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]
    
    return paginate(items, total, pagination)


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    role: str = Query(..., description="New role: user, artist, or admin"),
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Update a user's role (admin only)."""
    from app.models import UserRole
    
    # Validate role
    valid_roles = [r.value for r in UserRole]
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {valid_roles}"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent removing own admin role
    if user.id == admin.id and role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin privileges"
        )
    
    user.role = role
    db.commit()
    
    return {"message": f"User {user_id} role updated to {role}"}
