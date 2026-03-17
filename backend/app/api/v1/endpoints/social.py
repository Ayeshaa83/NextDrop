from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.crud import social as social_crud
from app.crud import artist as artist_crud
from app.schemas.social import (
    CollaborationCreate, 
    CollaborationUpdate, 
    CollaborationResponse, 
    LeaderboardEntry,
    CollaborationStatusEnum
)
from app.models import User
from app.models.social import CollaborationStatus
from typing import List

router = APIRouter()

def get_current_artist(db: Session, current_user: User):
    """Helper to get current user's artist profile."""
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=400,
            detail="You need an artist profile to use social features."
        )
    return artist

# --- Collaboration Endpoints ---

@router.post("/collaborate", response_model=CollaborationResponse, status_code=status.HTTP_201_CREATED)
def create_collaboration_request(
    collab_in: CollaborationCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Send a collaboration request to another artist."""
    artist = get_current_artist(db, current_user)
    
    # Verify collaborator exists
    collaborator = artist_crud.get_artist_by_id(db, artist_id=collab_in.collaborator_id)
    if not collaborator:
        raise HTTPException(status_code=404, detail="Collaborator artist not found")
    
    if collab_in.collaborator_id == artist.id:
        raise HTTPException(status_code=400, detail="You cannot collaborate with yourself")
    
    return social_crud.create_collaboration(db, collab_in=collab_in, initiator_id=artist.id)

@router.get("/collaborations", response_model=PaginatedResponse[CollaborationResponse])
def list_my_collaborations(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """List all collaborations for the current artist with pagination."""
    artist = get_current_artist(db, current_user)
    items = social_crud.get_collaborations_for_artist(db, artist_id=artist.id, skip=pagination.skip, limit=pagination.limit)
    total = social_crud.count_collaborations_for_artist(db, artist_id=artist.id)
    return paginate(items, total, pagination.skip, pagination.limit)

@router.get("/collaborations/pending", response_model=PaginatedResponse[CollaborationResponse])
def list_pending_requests(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """List pending collaboration requests for the current artist with pagination."""
    artist = get_current_artist(db, current_user)
    items = social_crud.get_pending_collaborations(db, artist_id=artist.id, skip=pagination.skip, limit=pagination.limit)
    total = social_crud.count_pending_collaborations(db, artist_id=artist.id)
    return paginate(items, total, pagination.skip, pagination.limit)

@router.put("/collaborations/{collab_id}", response_model=CollaborationResponse)
def respond_to_collaboration(
    collab_id: int,
    collab_update: CollaborationUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Accept or complete a collaboration request."""
    artist = get_current_artist(db, current_user)
    
    collab = social_crud.get_collaboration_by_id(db, collab_id=collab_id)
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    # Only collaborator can accept, either party can mark as completed
    if collab_update.status == CollaborationStatusEnum.ACCEPTED:
        if collab.collaborator_id != artist.id:
            raise HTTPException(status_code=403, detail="Only the invited artist can accept")
    elif collab.initiator_id != artist.id and collab.collaborator_id != artist.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this collaboration")
    
    # Map enum to model
    status_map = {
        CollaborationStatusEnum.PENDING: CollaborationStatus.PENDING,
        CollaborationStatusEnum.ACCEPTED: CollaborationStatus.ACCEPTED,
        CollaborationStatusEnum.COMPLETED: CollaborationStatus.COMPLETED
    }
    
    return social_crud.update_collaboration_status(db, collab=collab, status=status_map[collab_update.status])

# --- Leaderboard Endpoints ---

@router.get("/leaderboard", response_model=PaginatedResponse[LeaderboardEntry])
def get_leaderboard(
    category: str = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db)
):
    """Get the global leaderboard with pagination. Optionally filter by category."""
    items = social_crud.get_leaderboard(db, category=category, skip=pagination.skip, limit=pagination.limit)
    total = social_crud.count_leaderboard_entries(db, category=category)
    return paginate(items, total, pagination.skip, pagination.limit)

@router.get("/leaderboard/categories")
def get_leaderboard_categories():
    """Get available leaderboard categories."""
    return {
        "categories": [
            "Top Tracks",
            "Viral Producers",
            "Most Collaborative",
            "Rising Stars",
            "Open Verse Champions"
        ]
    }
