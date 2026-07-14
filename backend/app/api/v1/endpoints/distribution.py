"""
Distribution Endpoints
Handles pushing tracks to external platforms via the Platform Registry.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.api import deps
from app.crud import artist as artist_crud
from app.models import User, Track, TrackDistribution, SocialAccount, DistributionStatus
from app.platforms.registry import registry
from app.sec.encryption import decrypt_token
from app.sec.rate_limiter import limiter

router = APIRouter()


# ============ SCHEMAS ============

class DistributeTrackRequest(BaseModel):
    track_id: int
    platform_id: str
    territories: Optional[List[str]] = None  # ISO country codes; None = worldwide
    options: Optional[dict] = None  # e.g., {"privacy": "public", "category_id": "10"}


class DistributionResponse(BaseModel):
    id: int
    track_id: int
    platform: str
    status: str
    platform_track_id: Optional[str]
    platform_url: Optional[str]
    error_message: Optional[str]
    territories: Optional[List[str]] = None
    distributed_at: Optional[datetime]

    class Config:
        from_attributes = True


class DistributionPlatform(BaseModel):
    id: str
    name: str
    description: str
    color: str
    category: str
    supports_distribution: bool
    connected: bool
    login_endpoint: Optional[str]


# ============ ENDPOINTS ============

@router.get("/platforms", response_model=List[DistributionPlatform])
def list_distribution_platforms(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    All registered platform adapters with the current user's connection
    status. The distribution UI renders its platform cards from this —
    no platform is hardcoded in the frontend.
    """
    from app.models import PlatformConfig

    connected_providers = {
        row.provider
        for row in db.query(SocialAccount.provider).filter(
            SocialAccount.user_id == current_user.id
        ).all()
    }

    disabled = {
        c.platform_id
        for c in db.query(PlatformConfig).filter(PlatformConfig.enabled == False).all()
    }

    return [
        DistributionPlatform(
            id=adapter.platform_id,
            name=adapter.platform_name,
            description=adapter.description,
            color=adapter.brand_color,
            category=adapter.category,
            supports_distribution=adapter.supports_distribution,
            connected=adapter.platform_id in connected_providers,
            login_endpoint=adapter.login_endpoint,
        )
        for adapter in registry.get_all_adapters()
        if adapter.platform_id not in disabled
    ]

@router.post("/", response_model=DistributionResponse)
@limiter.limit("3/minute")
async def distribute_track(
    request: Request,
    req: DistributeTrackRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Distribute a track to a specific platform.
    
    1. Validates the track exists and belongs to the user.
    2. Retrieves the platform adapter from the registry.
    3. Checks if the user has connected that platform via OAuth.
    4. Invokes the adapter's `distribute()` capability.
    5. Records the outcome in `track_distributions` table.
    """
    # 1. Validate Track (ownership goes through the user's artist profile)
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You need to create an artist profile first."
        )

    from app.models import ArtistApprovalStatus, ApprovalStatus
    if artist.approval_status != ArtistApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your artist profile is awaiting admin approval before you can distribute."
        )

    track = db.query(Track).filter(
        Track.id == req.track_id,
        Track.artist_id == artist.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found or does not belong to you."
        )

    # Tracks must pass admin review before going out to platforms
    if track.approval_status != ApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This track hasn't been approved by an admin yet. "
                   "Distribution unlocks once it passes review."
        )

    # 2. Get Platform Adapter
    adapter = registry.get_adapter(req.platform_id)
    if not adapter:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Platform '{req.platform_id}' is not supported."
        )

    # Admins can disable a platform via the platform management panel
    from app.models import PlatformConfig
    cfg = db.query(PlatformConfig).filter(PlatformConfig.platform_id == req.platform_id).first()
    if cfg and not cfg.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{adapter.platform_name} distribution is currently disabled by the platform admins."
        )
        
    if not adapter.supports_distribution:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Platform '{req.platform_id}' does not support direct distribution."
        )

    # 3. Get User's Connected Account
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.provider == req.platform_id
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have not connected your {adapter.platform_name} account."
        )
        
    # Check if we already distributed this track to this platform
    existing_dist = db.query(TrackDistribution).filter(
        TrackDistribution.track_id == track.id,
        TrackDistribution.platform == req.platform_id
    ).first()
    
    if existing_dist and existing_dist.status == DistributionStatus.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Track is already distributed to {adapter.platform_name}."
        )
        
    # Create or update the distribution record as PENDING
    if not existing_dist:
        dist = TrackDistribution(
            track_id=track.id,
            artist_id=track.artist_id,
            platform=req.platform_id,
            status=DistributionStatus.PENDING,
            territories=req.territories,
        )
        db.add(dist)
    else:
        dist = existing_dist
        dist.status = DistributionStatus.PENDING
        dist.error_message = None
        if req.territories is not None:
            dist.territories = req.territories

    db.commit()
    db.refresh(dist)

    # 4. Invoke the Adapter
    try:
        # Token refresh logic is typically handled by the endpoint wrapping it,
        # but to ensure robustness, we refresh if expired right before uploading.
        if account.expires_at and account.expires_at < datetime.utcnow():
            new_tokens = await adapter.refresh_token(account)
            for k, v in new_tokens.items():
                if hasattr(account, k) and v is not None:
                    setattr(account, k, v)
            account.updated_at = datetime.utcnow()
            db.commit()
            
        # Decrypt tokens before using them in the adapter
        account.access_token = decrypt_token(account.access_token)
        if account.refresh_token:
            account.refresh_token = decrypt_token(account.refresh_token)
            
        result = await adapter.distribute(track=track, account=account, options=req.options)
        
        # 5. Record Outcome
        dist.status = DistributionStatus(result.status)
        dist.platform_track_id = result.platform_track_id
        dist.platform_url = result.platform_url
        dist.error_message = result.error_message
        dist.platform_metadata = result.platform_metadata
        if dist.status == DistributionStatus.LIVE:
            dist.distributed_at = datetime.utcnow()
            
        db.commit()
        db.refresh(dist)
        return dist

    except Exception as e:
        dist.status = DistributionStatus.FAILED
        dist.error_message = str(e)
        db.commit()
        db.refresh(dist)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Distribution failed: {str(e)}"
        )


@router.get("/track/{track_id}", response_model=List[DistributionResponse])
def get_track_distributions(
    track_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get all distribution statuses for a specific track.
    """
    # Verify ownership through the user's artist profile
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    track = db.query(Track).filter(
        Track.id == track_id,
        Track.artist_id == (artist.id if artist else -1)
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found or does not belong to you."
        )
        
    distributions = db.query(TrackDistribution).filter(
        TrackDistribution.track_id == track_id
    ).all()
    
    return distributions
