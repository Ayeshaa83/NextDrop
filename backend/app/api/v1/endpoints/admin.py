"""
Admin API Endpoints
Handles track approvals, plagiarism checks, and system administration.
All routes require ADMIN role.
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.models import User, Track, ApprovalStatus, NotificationType
from app.services import email_service, notification_service


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
    metadata_quality_score: Optional[float] = None
    ai_verified: bool = False

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
            created_at=None,  # Track model doesn't have created_at yet
            metadata_quality_score=(
                float(track.ai_analysis.get("metadata_quality_score"))
                if isinstance(track.ai_analysis, dict)
                and isinstance(track.ai_analysis.get("metadata_quality_score"), (int, float))
                else None
            ),
            ai_verified=(
                isinstance(track.ai_analysis, dict)
                and isinstance(track.ai_analysis.get("metadata_quality_score"), (int, float))
                and float(track.ai_analysis.get("metadata_quality_score")) >= 80.0
            ),
        )
        items.append(item)
    
    return paginate(items, total, pagination.skip, pagination.limit)


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
            created_at=None,
            metadata_quality_score=(
                float(track.ai_analysis.get("metadata_quality_score"))
                if isinstance(track.ai_analysis, dict)
                and isinstance(track.ai_analysis.get("metadata_quality_score"), (int, float))
                else None
            ),
            ai_verified=(
                isinstance(track.ai_analysis, dict)
                and isinstance(track.ai_analysis.get("metadata_quality_score"), (int, float))
                and float(track.ai_analysis.get("metadata_quality_score")) >= 80.0
            ),
        )
        items.append(item)
    
    return paginate(items, total, pagination.skip, pagination.limit)


@router.put("/tracks/{track_id}/approve", response_model=TrackApprovalResponse)
def approve_track(
    track_id: int,
    action: ApprovalAction,
    background_tasks: BackgroundTasks,
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

    # Notify the artist — email + in-app
    if artist:
        owner = db.query(User).filter(User.id == artist.user_id).first()
        if owner:
            is_approved = action.status == ApprovalStatus.APPROVED.value
            subject, html = email_service.track_approval_email(
                owner.email, track.title, approved=is_approved, notes=action.notes,
            )
            background_tasks.add_task(email_service.send, owner.email, subject, html)

            notification_service.create(
                db, owner.id,
                NotificationType.TRACK_APPROVED if is_approved else NotificationType.TRACK_REJECTED,
                title=f'"{track.title}" was approved' if is_approved else f'"{track.title}" was rejected',
                body=(f"Ready to distribute." if is_approved
                      else (action.notes or "No reason was provided. You can revise and re-upload.")),
                link="/music" if is_approved else f"/tracks/{track.id}",
            )

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
        created_at=None,
        metadata_quality_score=(
            float(track.ai_analysis.get("metadata_quality_score"))
            if isinstance(track.ai_analysis, dict)
            and isinstance(track.ai_analysis.get("metadata_quality_score"), (int, float))
            else None
        ),
        ai_verified=(
            isinstance(track.ai_analysis, dict)
            and isinstance(track.ai_analysis.get("metadata_quality_score"), (int, float))
            and float(track.ai_analysis.get("metadata_quality_score")) >= 80.0
        ),
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
        created_at=None,
        metadata_quality_score=(
            float(track.ai_analysis.get("metadata_quality_score"))
            if isinstance(track.ai_analysis, dict)
            and isinstance(track.ai_analysis.get("metadata_quality_score"), (int, float))
            else None
        ),
        ai_verified=(
            isinstance(track.ai_analysis, dict)
            and isinstance(track.ai_analysis.get("metadata_quality_score"), (int, float))
            and float(track.ai_analysis.get("metadata_quality_score")) >= 80.0
        ),
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
    
    return paginate(items, total, pagination.skip, pagination.limit)


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


# ============ PAYOUT MANAGEMENT ============

class AdminPayoutResponse(BaseModel):
    id: int
    user_id: int
    user_email: Optional[str] = None
    amount: float
    method: str
    status: str
    reference: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@router.get("/payouts", response_model=PaginatedResponse[AdminPayoutResponse])
def list_payouts(
    pagination: PaginationParams = Depends(),
    status_filter: Optional[str] = Query(None, description="processing, completed, or rejected"),
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """All payout requests across the platform (newest first)."""
    from app.models import Payout

    query = db.query(Payout, User.email).join(User, Payout.user_id == User.id)
    if status_filter:
        query = query.filter(Payout.status == status_filter)
    total = query.count()
    rows = (
        query.order_by(Payout.created_at.desc())
        .offset(pagination.skip).limit(pagination.limit).all()
    )

    items = [
        AdminPayoutResponse(
            id=p.id, user_id=p.user_id, user_email=email, amount=p.amount,
            method=p.method, status=p.status, reference=p.reference,
            created_at=p.created_at, completed_at=p.completed_at,
        )
        for p, email in rows
    ]
    return paginate(items, total, pagination.skip, pagination.limit)


@router.put("/payouts/{payout_id}/status", response_model=AdminPayoutResponse)
def update_payout_status(
    payout_id: int,
    background_tasks: BackgroundTasks,
    new_status: str = Query(..., description="completed or rejected"),
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Mark a payout as paid (completed) or reject it (funds return to balance)."""
    from app.models import Payout, PayoutStatus

    if new_status not in (PayoutStatus.COMPLETED.value, PayoutStatus.REJECTED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'completed' or 'rejected'"
        )

    payout = db.query(Payout).filter(Payout.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found")

    if payout.status != PayoutStatus.PROCESSING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payout is already {payout.status}"
        )

    payout.status = new_status
    payout.completed_at = datetime.utcnow() if new_status == PayoutStatus.COMPLETED.value else None
    db.commit()
    db.refresh(payout)

    user = db.query(User).filter(User.id == payout.user_id).first()

    if user:
        is_completed = new_status == PayoutStatus.COMPLETED.value
        subject, html = email_service.payout_email(
            user.email, payout.amount, completed=is_completed, reference=payout.reference,
        )
        background_tasks.add_task(email_service.send, user.email, subject, html)

        notification_service.create(
            db, user.id,
            NotificationType.PAYOUT_COMPLETED if is_completed else NotificationType.PAYOUT_REJECTED,
            title=f"Payout of ${payout.amount:.2f} {'completed' if is_completed else 'declined'}",
            body=(f"Reference: {payout.reference}" if is_completed and payout.reference
                  else "The amount has been returned to your wallet." if not is_completed else ""),
            link="/earnings",
        )

    return AdminPayoutResponse(
        id=payout.id, user_id=payout.user_id,
        user_email=user.email if user else None,
        amount=payout.amount, method=payout.method, status=payout.status,
        reference=payout.reference, created_at=payout.created_at,
        completed_at=payout.completed_at,
    )


# ============ ARTIST APPROVAL & VERIFICATION ============

class AdminArtistResponse(BaseModel):
    id: int
    user_id: int
    stage_name: str
    user_email: Optional[str] = None
    approval_status: str = "approved"
    approval_reviewed_at: Optional[datetime] = None
    is_verified: bool
    verified_at: Optional[datetime] = None
    track_count: int = 0


def _admin_artist_response(db: Session, artist, email: Optional[str] = None, track_count: Optional[int] = None) -> AdminArtistResponse:
    if email is None:
        user = db.query(User).filter(User.id == artist.user_id).first()
        email = user.email if user else None
    if track_count is None:
        track_count = db.query(func.count(Track.id)).filter(Track.artist_id == artist.id).scalar() or 0
    return AdminArtistResponse(
        id=artist.id, user_id=artist.user_id, stage_name=artist.stage_name,
        user_email=email,
        approval_status=artist.approval_status,
        approval_reviewed_at=artist.approval_reviewed_at,
        is_verified=artist.is_verified, verified_at=artist.verified_at,
        track_count=track_count,
    )


@router.get("/artists", response_model=PaginatedResponse[AdminArtistResponse])
def list_artists_admin(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """All artist profiles with verification state (newest first)."""
    from app.models import Artist

    query = db.query(Artist, User.email).join(User, Artist.user_id == User.id)
    total = query.count()
    rows = query.order_by(Artist.id.desc()).offset(pagination.skip).limit(pagination.limit).all()

    track_counts = dict(
        db.query(Track.artist_id, func.count(Track.id))
        .filter(Track.artist_id.in_([a.id for a, _ in rows] or [-1]))
        .group_by(Track.artist_id)
        .all()
    )

    items = [
        _admin_artist_response(db, a, email=email, track_count=track_counts.get(a.id, 0))
        for a, email in rows
    ]
    return paginate(items, total, pagination.skip, pagination.limit)


@router.put("/artists/{artist_id}/approval", response_model=AdminArtistResponse)
def set_artist_approval(
    artist_id: int,
    background_tasks: BackgroundTasks,
    approval: str = Query(..., description="approved or rejected"),
    notes: str | None = Query(None, description="Optional reason, shown to the artist if rejected"),
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Approve or reject an artist's onboarding (gates upload/distribution)."""
    from app.models import Artist, ArtistApprovalStatus

    if approval not in (ArtistApprovalStatus.APPROVED.value, ArtistApprovalStatus.REJECTED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="approval must be 'approved' or 'rejected'"
        )

    artist = db.query(Artist).filter(Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")

    artist.approval_status = approval
    artist.approval_reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(artist)

    user = db.query(User).filter(User.id == artist.user_id).first()
    if user:
        is_approved = approval == ArtistApprovalStatus.APPROVED.value
        subject, html = email_service.artist_approval_email(
            user.email, artist.stage_name, approved=is_approved,
        )
        background_tasks.add_task(email_service.send, user.email, subject, html)

        notification_service.create(
            db, user.id,
            NotificationType.ARTIST_APPROVED if is_approved else NotificationType.ARTIST_REJECTED,
            title="Your artist profile was approved 🎉" if is_approved else "Your artist profile was not approved",
            body=("You can now upload and distribute music." if is_approved
                  else (notes or "Contact support for details.")),
            link="/upload" if is_approved else "/account",
        )

    return _admin_artist_response(db, artist, email=user.email if user else None)


@router.put("/artists/{artist_id}/verify", response_model=AdminArtistResponse)
def set_artist_verification(
    artist_id: int,
    verified: bool = Query(..., description="true to verify, false to revoke"),
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Grant or revoke the artist verification badge."""
    from app.models import Artist

    artist = db.query(Artist).filter(Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")

    artist.is_verified = verified
    artist.verified_at = datetime.utcnow() if verified else None
    db.commit()
    db.refresh(artist)

    if verified:
        notification_service.create(
            db, artist.user_id, NotificationType.VERIFICATION_GRANTED,
            title="You're now a Verified Artist ✓",
            body="Your profile now shows the verification badge.",
            link="/account",
        )

    return _admin_artist_response(db, artist)


# ============ PLATFORM-WIDE ANALYTICS ============

@router.get("/analytics")
def platform_analytics(
    days: int = Query(30, ge=7, le=180),
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Daily signups and uploads for admin charts, plus the approval funnel."""
    import datetime as dt

    since = dt.date.today() - dt.timedelta(days=days - 1)

    signup_rows = (
        db.query(func.date(User.created_at), func.count(User.id))
        .filter(User.created_at >= since)
        .group_by(func.date(User.created_at))
        .all()
    )
    upload_rows = (
        db.query(func.date(Track.created_at), func.count(Track.id))
        .filter(Track.created_at >= since)
        .group_by(func.date(Track.created_at))
        .all()
    )

    signups = {str(d): int(c) for d, c in signup_rows}
    uploads = {str(d): int(c) for d, c in upload_rows}

    points = []
    for i in range(days):
        day = since + dt.timedelta(days=i)
        key = str(day)
        points.append({
            "date": key,
            "signups": signups.get(key, 0),
            "uploads": uploads.get(key, 0),
        })

    funnel = dict(
        db.query(Track.approval_status, func.count(Track.id))
        .group_by(Track.approval_status)
        .all()
    )

    return {"days": days, "points": points, "approval_funnel": funnel}


# ============ PLATFORM MANAGEMENT ============

class PlatformConfigBody(BaseModel):
    platform_id: str
    display_name: str
    description: str = ""
    color: str = "#888888"
    category: str = "music"  # music | video | social
    enabled: bool = True


class PlatformConfigResponse(PlatformConfigBody):
    id: int
    has_adapter: bool = False  # True = real integration exists in code

    class Config:
        from_attributes = True


def _config_response(cfg) -> PlatformConfigResponse:
    from app.platforms.registry import registry
    return PlatformConfigResponse(
        id=cfg.id, platform_id=cfg.platform_id, display_name=cfg.display_name,
        description=cfg.description, color=cfg.color, category=cfg.category,
        enabled=cfg.enabled,
        has_adapter=registry.get_adapter(cfg.platform_id) is not None,
    )


@router.get("/platforms", response_model=list[PlatformConfigResponse])
def list_platform_configs(
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """All managed platforms. Rows with has_adapter=True are live integrations
    (toggle `enabled` to hide them platform-wide); the rest are Coming Soon
    placeholders that admins can add/edit/remove freely."""
    from app.models import PlatformConfig
    from app.platforms.registry import registry

    configs = db.query(PlatformConfig).order_by(PlatformConfig.platform_id).all()
    known = {c.platform_id for c in configs}

    # Ensure every code adapter has a config row so admins can manage it
    created = False
    for adapter in registry.get_all_adapters():
        if adapter.platform_id not in known:
            db.add(PlatformConfig(
                platform_id=adapter.platform_id,
                display_name=adapter.platform_name,
                description=adapter.description,
                color=adapter.brand_color,
                category=adapter.category,
                enabled=True,
            ))
            created = True
    if created:
        db.commit()
        configs = db.query(PlatformConfig).order_by(PlatformConfig.platform_id).all()

    return [_config_response(c) for c in configs]


@router.post("/platforms", response_model=PlatformConfigResponse, status_code=status.HTTP_201_CREATED)
def create_platform_config(
    body: PlatformConfigBody,
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Add a platform (renders as Coming Soon until a code adapter exists)."""
    from app.models import PlatformConfig

    platform_id = body.platform_id.strip().lower().replace(" ", "_")
    if not platform_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="platform_id is required")

    existing = db.query(PlatformConfig).filter(PlatformConfig.platform_id == platform_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Platform already exists")

    cfg = PlatformConfig(
        platform_id=platform_id, display_name=body.display_name,
        description=body.description, color=body.color,
        category=body.category, enabled=body.enabled,
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _config_response(cfg)


@router.put("/platforms/{config_id}", response_model=PlatformConfigResponse)
def update_platform_config(
    config_id: int,
    body: PlatformConfigBody,
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Edit a platform's display info or enable/disable it."""
    from app.models import PlatformConfig

    cfg = db.query(PlatformConfig).filter(PlatformConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform config not found")

    cfg.display_name = body.display_name
    cfg.description = body.description
    cfg.color = body.color
    cfg.category = body.category
    cfg.enabled = body.enabled
    db.commit()
    db.refresh(cfg)
    return _config_response(cfg)


@router.delete("/platforms/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_platform_config(
    config_id: int,
    db: Session = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    """Remove a Coming Soon platform. Platforms with a code adapter can only
    be disabled, not deleted."""
    from app.models import PlatformConfig
    from app.platforms.registry import registry

    cfg = db.query(PlatformConfig).filter(PlatformConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform config not found")

    if registry.get_adapter(cfg.platform_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This platform has a live integration — disable it instead of deleting."
        )

    db.delete(cfg)
    db.commit()
    return None
