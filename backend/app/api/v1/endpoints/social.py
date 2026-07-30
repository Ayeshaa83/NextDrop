from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.crud import social as social_crud
from app.crud import artist as artist_crud
from app.schemas.social import (
    CollaborationCreate,
    CollaborationUpdate,
    CollaborationTrackUpdate,
    CollaborationResponse,
    LeaderboardEntry,
    CollaborationStatusEnum,
    ArtistSummary,
    CollabMessageCreate,
    CollabMessageResponse,
)
from app.models import User, Track, NotificationType
from app.models.social import Collaboration, CollaborationStatus
from app.services import notification_service

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


def _to_collab_response(collab: Collaboration, viewer_user_id: int, db: Session) -> CollaborationResponse:
    return CollaborationResponse(
        id=collab.id,
        initiator_id=collab.initiator_id,
        collaborator_id=collab.collaborator_id,
        track_id=collab.track_id,
        status=collab.status,
        message=collab.message,
        created_at=collab.created_at,
        initiator=ArtistSummary.model_validate(collab.initiator) if collab.initiator else None,
        collaborator=ArtistSummary.model_validate(collab.collaborator) if collab.collaborator else None,
        track_title=collab.track.title if collab.track else None,
        unread_count=social_crud.get_unread_message_count_for_collab(db, collab.id, viewer_user_id),
    )


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

    collab = social_crud.create_collaboration(db, collab_in=collab_in, initiator_id=artist.id)

    notification_service.create(
        db, collaborator.user_id,
        NotificationType.COLLAB_REQUEST,
        title=f"{artist.stage_name} wants to collaborate",
        body=collab_in.message or "Check out their request in Collabs.",
        link="/collabs",
    )

    return _to_collab_response(collab, current_user.id, db)

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
    responses = [_to_collab_response(c, current_user.id, db) for c in items]
    return paginate(responses, total, pagination.skip, pagination.limit)

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
    responses = [_to_collab_response(c, current_user.id, db) for c in items]
    return paginate(responses, total, pagination.skip, pagination.limit)

@router.get("/collaborations/unread-count")
def get_collab_unread_count(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Total unread chat messages across all my collaborations — for the Sidebar badge."""
    artist = get_current_artist(db, current_user)
    count = social_crud.get_unread_message_count_for_artist(db, artist_id=artist.id, user_id=current_user.id)
    return {"unread_count": count}

@router.put("/collaborations/{collab_id}", response_model=CollaborationResponse)
def respond_to_collaboration(
    collab_id: int,
    collab_update: CollaborationUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Accept, reject, or complete a collaboration request."""
    artist = get_current_artist(db, current_user)

    collab = social_crud.get_collaboration_by_id(db, collab_id=collab_id)
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")

    # Only the invited artist can accept/reject; either party can mark as completed
    if collab_update.status in (CollaborationStatusEnum.ACCEPTED, CollaborationStatusEnum.REJECTED):
        if collab.collaborator_id != artist.id:
            raise HTTPException(status_code=403, detail="Only the invited artist can respond to this request")
    elif collab.initiator_id != artist.id and collab.collaborator_id != artist.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this collaboration")

    status_map = {
        CollaborationStatusEnum.PENDING: CollaborationStatus.PENDING,
        CollaborationStatusEnum.ACCEPTED: CollaborationStatus.ACCEPTED,
        CollaborationStatusEnum.COMPLETED: CollaborationStatus.COMPLETED,
        CollaborationStatusEnum.REJECTED: CollaborationStatus.REJECTED,
    }

    updated = social_crud.update_collaboration_status(db, collab=collab, status=status_map[collab_update.status])

    # Notify the initiator of the outcome (they only ever heard about the request itself before this)
    if collab_update.status in (CollaborationStatusEnum.ACCEPTED, CollaborationStatusEnum.REJECTED):
        initiator = artist_crud.get_artist_by_id(db, artist_id=collab.initiator_id)
        if initiator:
            is_accepted = collab_update.status == CollaborationStatusEnum.ACCEPTED
            notification_service.create(
                db, initiator.user_id,
                NotificationType.COLLAB_ACCEPTED if is_accepted else NotificationType.COLLAB_REJECTED,
                title=f"{artist.stage_name} {'accepted' if is_accepted else 'declined'} your collaboration request",
                body="You can now chat in Collabs." if is_accepted else "",
                link="/collabs",
            )

    return _to_collab_response(updated, current_user.id, db)


@router.put("/collaborations/{collab_id}/track", response_model=CollaborationResponse)
def add_track_to_collaboration(
    collab_id: int,
    track_update: CollaborationTrackUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Attach the finished song to an accepted collaboration, so it shows up as the
    collab's track in the Collabs section. Either participant can add it, and the
    track must be one they own.
    """
    artist = get_current_artist(db, current_user)

    collab = social_crud.get_collaboration_by_id(db, collab_id=collab_id)
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    if collab.initiator_id != artist.id and collab.collaborator_id != artist.id:
        raise HTTPException(status_code=403, detail="Not a participant in this collaboration")
    if collab.status not in (CollaborationStatus.ACCEPTED.value, CollaborationStatus.COMPLETED.value):
        raise HTTPException(status_code=400, detail="You can only add a song once the collaboration is accepted")

    track = db.query(Track).filter(Track.id == track_update.track_id, Track.artist_id == artist.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found or you don't own this track")

    updated = social_crud.set_collaboration_track(db, collab=collab, track_id=track.id)

    other_artist_id = collab.collaborator_id if collab.initiator_id == artist.id else collab.initiator_id
    other = artist_crud.get_artist_by_id(db, artist_id=other_artist_id)
    if other:
        notification_service.create(
            db, other.user_id,
            NotificationType.COLLAB_ACCEPTED,
            title=f"{artist.stage_name} added a song to your collaboration",
            body=f'"{track.title}" is now attached to your collaboration.',
            link="/collabs",
        )

    return _to_collab_response(updated, current_user.id, db)


# --- Collaboration chat messages ---

@router.get("/collaborations/{collab_id}/messages", response_model=PaginatedResponse[CollabMessageResponse])
def list_collab_messages(
    collab_id: int,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Chat history for an accepted collaboration. Viewing marks the other party's messages read."""
    artist = get_current_artist(db, current_user)
    collab = social_crud.get_collaboration_by_id(db, collab_id=collab_id)
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    if collab.initiator_id != artist.id and collab.collaborator_id != artist.id:
        raise HTTPException(status_code=403, detail="Not a participant in this collaboration")
    if collab.status not in (CollaborationStatus.ACCEPTED.value, CollaborationStatus.COMPLETED.value):
        raise HTTPException(status_code=400, detail="Chat is only available for accepted collaborations")

    items = social_crud.get_collab_messages(db, collaboration_id=collab_id, skip=pagination.skip, limit=pagination.limit)
    total = social_crud.count_collab_messages(db, collaboration_id=collab_id)
    social_crud.mark_collab_messages_read(db, collaboration_id=collab_id, reader_user_id=current_user.id)

    responses = [
        CollabMessageResponse(
            id=m.id, collaboration_id=m.collaboration_id, sender_id=m.sender_id,
            content=m.content, created_at=m.created_at, is_mine=(m.sender_id == current_user.id),
        )
        for m in items
    ]
    return paginate(responses, total, pagination.skip, pagination.limit)

@router.post("/collaborations/{collab_id}/messages", response_model=CollabMessageResponse, status_code=status.HTTP_201_CREATED)
def send_collab_message(
    collab_id: int,
    message_in: CollabMessageCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Send a chat message in an accepted collaboration."""
    artist = get_current_artist(db, current_user)
    collab = social_crud.get_collaboration_by_id(db, collab_id=collab_id)
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    if collab.initiator_id != artist.id and collab.collaborator_id != artist.id:
        raise HTTPException(status_code=403, detail="Not a participant in this collaboration")
    if collab.status not in (CollaborationStatus.ACCEPTED.value, CollaborationStatus.COMPLETED.value):
        raise HTTPException(status_code=400, detail="Chat is only available for accepted collaborations")

    msg = social_crud.create_collab_message(db, collaboration_id=collab_id, sender_id=current_user.id, content=message_in.content)
    return CollabMessageResponse(
        id=msg.id, collaboration_id=msg.collaboration_id, sender_id=msg.sender_id,
        content=msg.content, created_at=msg.created_at, is_mine=True,
    )


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


@router.get("/leaderboard/me")
def get_my_leaderboard_position(
    category: str = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """The current artist's own rank, points, and field size."""
    from app.crud import artist as artist_crud
    from app.models import Leaderboard

    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    total = social_crud.count_leaderboard_entries(db, category=category)

    if not artist:
        return {"ranked": False, "total_artists": total}

    query = db.query(Leaderboard).filter(Leaderboard.artist_id == artist.id)
    if category:
        query = query.filter(Leaderboard.category == category)
    entry = query.order_by(Leaderboard.rank).first()

    if not entry:
        return {"ranked": False, "total_artists": total}

    return {
        "ranked": True,
        "rank": entry.rank,
        "points": entry.points,
        "category": entry.category,
        "total_artists": total,
    }
