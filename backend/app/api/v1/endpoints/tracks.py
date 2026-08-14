from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.crud import track as track_crud
from app.crud import artist as artist_crud
from app.schemas.track import (
    TrackCreate, TrackUpdate, TrackResponse,
    TrackProcessingStatus, AIAnalysisResponse,
    AnalyzeFileResponse
)
from app.models import User, TrackDistribution, DistributionStatus
from app.processing.tasks import process_track_analysis
from app.platforms.registry import registry
from app.services.platform_accounts import get_ready_account
from app.services.earnings_service import compute_artist_earnings
from app.storage import StorageClient, get_storage_client
import tempfile
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Standalone File-Upload Analyze Endpoint ────────────────────────────

@router.post("/analyze", response_model=AnalyzeFileResponse)
async def analyze_uploaded_file(
    file: UploadFile = File(..., description="Audio file to analyze (MP3, WAV, FLAC, OGG)")
):
    """
    Analyze an uploaded audio file using Musicnn auto-tagger + XGBoost hit predictor.

    This endpoint:
    1. Saves the uploaded file to a temp location
    2. Runs Musicnn tagger in a subprocess (isolated, CPU-only)
    3. Runs XGBoost feature extraction + hit prediction
    4. Returns a unified JSON response with genre, style, mood, instruments, vocals, and hit_score

    No authentication required — this is a standalone analysis tool.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Please upload an audio file."
        )

    # Save uploaded file to temp location
    suffix = os.path.splitext(file.filename or "track.mp3")[1] or ".mp3"
    fd, temp_path = tempfile.mkstemp(suffix=suffix)

    try:
        # Write uploaded content to temp file
        content = await file.read()
        with os.fdopen(fd, "wb") as f:
            f.write(content)

        logger.info(f"Saved uploaded file to {temp_path} ({len(content)} bytes)")

        # ── Musicnn tagger removed (using PANNs/XGBoost instead) ──────────
        musicnn_result = {
            "tags_raw": [], "genre": [], "style": [], "mood": [],
            "instruments": [], "vocals": [], "error": None
        }

        # ── Run XGBoost feature extraction + hit prediction ────────────
        xgboost_result = {}
        try:
            from app.processing.audio_analyzer import AudioAnalyzer
            analyzer = AudioAnalyzer()
            analysis = analyzer.analyze_sync(temp_path)
            xgboost_result = analysis.to_dict()
            logger.info(f"XGBoost result: hit_score={xgboost_result.get('hit_score')}")
        except Exception as e:
            logger.warning(f"XGBoost analysis failed (non-fatal): {e}")

        # ── Merge results ──────────────────────────────────────────────
        features = xgboost_result.get("features", {})

        # Use musicnn genre if available, fall back to XGBoost heuristic
        genre_tags = musicnn_result.get("genre", [])
        if not genre_tags and xgboost_result.get("predicted_genre"):
            genre_tags = [{"name": xgboost_result["predicted_genre"], "confidence": 70}]

        return AnalyzeFileResponse(
            bpm=features.get("bpm"),
            key=features.get("key"),
            genre=genre_tags,
            style=musicnn_result.get("style", []),
            mood=musicnn_result.get("mood", []),
            instruments=musicnn_result.get("instruments", []),
            vocals=musicnn_result.get("vocals", []),
            hit_score=xgboost_result.get("hit_score"),
            features=features,
            hit_factors=xgboost_result.get("hit_factors"),
            tags_raw=musicnn_result.get("tags_raw", []),
            musicnn_error=musicnn_result.get("error"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    finally:
        # Cleanup temp file
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass

def get_current_artist_id(db: Session, current_user: User):
    """Helper to get artist ID from current user."""
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=400,
            detail="You need to create an artist profile first"
        )
    return artist.id


def require_approved_artist(db: Session, current_user: User):
    """Artists must pass admin onboarding approval before uploading."""
    from app.models import ArtistApprovalStatus

    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=400,
            detail="You need to create an artist profile first"
        )
    if artist.approval_status != ArtistApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=403,
            detail="Your artist profile is awaiting admin approval. "
                   "You'll be able to upload music once it's approved.",
        )
    return artist

@router.post("/", response_model=TrackResponse, status_code=status.HTTP_201_CREATED)
def create_track(
    track_in: TrackCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Upload a new track.
    
    The track is saved immediately with status='pending' and
    AI analysis runs in the background. Use GET /tracks/{id}/status
    to check processing progress.
    """
    artist = require_approved_artist(db, current_user)
    track = track_crud.create_track(db, track_in=track_in, artist_id=artist.id)
    
    # Queue background processing
    background_tasks.add_task(process_track_analysis, track.id)
    
    return track


@router.get("/{track_id}/status", response_model=TrackProcessingStatus)
def get_track_processing_status(
    track_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Check the processing status of a track.
    
    Returns current status (pending/processing/completed/failed)
    and AI analysis results if completed.
    """
    track = track_crud.get_track_by_id(db, track_id=track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Only allow owner to check status
    artist_id = get_current_artist_id(db, current_user)
    if track.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this track")
    
    return track


@router.get("/{track_id}/analysis", response_model=AIAnalysisResponse)
def get_track_ai_analysis(
    track_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get detailed AI analysis results for a track.
    
    Returns features, predicted genre, hit score, etc.
    Only available after processing is completed.
    """
    track = track_crud.get_track_by_id(db, track_id=track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Only allow owner to view analysis
    artist_id = get_current_artist_id(db, current_user)
    if track.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this track")
    
    if track.processing_status != "completed":
        raise HTTPException(
            status_code=400, 
            detail=f"Analysis not ready. Current status: {track.processing_status}"
        )
    
    if not track.ai_analysis:
        raise HTTPException(status_code=404, detail="No analysis data available")
    
    return AIAnalysisResponse(**track.ai_analysis)


@router.post("/{track_id}/reprocess", response_model=TrackProcessingStatus)
def reprocess_track(
    track_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Re-run AI analysis on a track.
    
    Useful for failed tracks or to get updated analysis.
    """
    artist_id = get_current_artist_id(db, current_user)
    track = track_crud.get_track_by_id(db, track_id=track_id)
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this track")
    
    # Reset status and queue reprocessing
    track.processing_status = "pending"
    track.processing_error = None
    db.commit()
    
    background_tasks.add_task(process_track_analysis, track.id)
    
    return track

@router.get("/", response_model=PaginatedResponse[TrackResponse])
def list_my_tracks(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """List all tracks for the current artist with pagination."""
    artist_id = get_current_artist_id(db, current_user)
    items = track_crud.get_tracks_by_artist(db, artist_id=artist_id, skip=pagination.skip, limit=pagination.limit)
    total = track_crud.count_tracks_by_artist(db, artist_id=artist_id)
    return paginate(items, total, pagination.skip, pagination.limit)

@router.get("/public", response_model=PaginatedResponse[TrackResponse])
def list_public_tracks(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db)
):
    """List all public tracks (for discovery/feeds) with pagination."""
    items = track_crud.get_all_public_tracks(db, skip=pagination.skip, limit=pagination.limit)
    total = track_crud.count_public_tracks(db)
    return paginate(items, total, pagination.skip, pagination.limit)

@router.get("/{track_id}", response_model=TrackResponse)
def get_track(
    track_id: int,
    db: Session = Depends(deps.get_db)
):
    """Get a specific track by ID."""
    track = track_crud.get_track_by_id(db, track_id=track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track

@router.put("/{track_id}", response_model=TrackResponse)
def update_track(
    track_id: int,
    track_in: TrackUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Update a track (only by owner)."""
    artist_id = get_current_artist_id(db, current_user)
    track = track_crud.get_track_by_id(db, track_id=track_id)
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this track")
    
    return track_crud.update_track(db, track=track, track_in=track_in)

class PlatformActionResult(BaseModel):
    platform: str
    success: bool
    error: Optional[str] = None


class UnpublishResponse(BaseModel):
    track: TrackResponse
    platforms: List[PlatformActionResult]
    # "unpublished"        — real takedown work happened just now
    # "already_unpublished" — this track was unpublished before this call
    # "not_published"      — it was never live on any platform to begin with
    outcome: str


async def _takedown_live_distributions(
    db: Session, track, current_user: User, *, permanent: bool
) -> List[PlatformActionResult]:
    """Shared by unpublish (reversible) and hard delete (permanent) — walks
    every live distribution and asks its adapter to take the real content
    down. Best-effort per platform; a failure here is reported back, not
    raised, so one broken platform connection doesn't block the others."""
    results: List[PlatformActionResult] = []
    live_dists = db.query(TrackDistribution).filter(
        TrackDistribution.track_id == track.id,
        TrackDistribution.status == DistributionStatus.LIVE.value,
    ).all()

    for dist in live_dists:
        adapter = registry.get_adapter(dist.platform)
        if not adapter:
            continue
        try:
            account = await get_ready_account(db, current_user.id, adapter)
            if not account:
                raise RuntimeError(f"{adapter.platform_name} is no longer connected")

            if permanent:
                await adapter.delete_content(dist.platform_track_id, account)
            else:
                await adapter.unpublish(dist.platform_track_id, account)

            dist.status = DistributionStatus.REMOVED.value
            results.append(PlatformActionResult(platform=dist.platform, success=True))
        except NotImplementedError:
            # Platform doesn't support takedown via API — still remove our
            # own tracking of it, just flag that the live content itself
            # wasn't touched so the artist knows to check it manually.
            dist.status = DistributionStatus.REMOVED.value
            results.append(PlatformActionResult(
                platform=dist.platform, success=False,
                error=f"{adapter.platform_name} doesn't support automatic takedown — remove it there manually.",
            ))
        except Exception as e:
            # Leave this distribution's status as LIVE — it may genuinely
            # still be live, and marking it removed would misreport that.
            logger.warning("Takedown failed for track %s on %s", track.id, dist.platform, exc_info=True)
            results.append(PlatformActionResult(platform=dist.platform, success=False, error=str(e)[:300]))

    db.commit()
    return results


@router.post("/{track_id}/unpublish", response_model=UnpublishResponse)
async def unpublish_track(
    track_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Reversible takedown: makes live platform content private (not deleted)
    and hides the track from NextDrop's own public listings. Analytics,
    earnings history, and the track record itself are untouched.
    """
    artist_id = get_current_artist_id(db, current_user)
    track = track_crud.get_track_by_id(db, track_id=track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this track")

    # Captured before any mutation, so we can tell "already unpublished
    # before this call" apart from "just unpublished it right now" —
    # otherwise every call looks identical from the response alone.
    was_already_unpublished = not track.is_public

    platform_results = await _takedown_live_distributions(db, track, current_user, permanent=False)

    # Hidden from our own listings regardless of whether every platform
    # takedown succeeded — that part is always within our control.
    track.is_public = False
    db.commit()
    db.refresh(track)

    if was_already_unpublished:
        outcome = "already_unpublished"
    elif not platform_results:
        outcome = "not_published"
    else:
        outcome = "unpublished"

    return UnpublishResponse(track=track, platforms=platform_results, outcome=outcome)


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_track(
    track_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    storage: StorageClient = Depends(get_storage_client),
):
    """
    Permanently delete a track: takes down live platform content for good,
    deletes its audio/cover files from storage, and removes the record
    (analytics/distributions/split-sheets cascade with it; JamJar posts and
    collaboration chats that referenced it keep existing, just lose the
    link — see the track_id ondelete behavior on those tables).

    Blocked once the track has contributed real earnings — hard-deleting it
    would silently shrink the artist's wallet balance on its next sync,
    since that's recomputed live from current track_analytics. Unpublish
    instead in that case; it's reversible and doesn't touch history.
    """
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(status_code=400, detail="You need to create an artist profile first")
    track = track_crud.get_track_by_id(db, track_id=track_id)

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this track")

    earnings = compute_artist_earnings(db, artist_id=artist.id, owner_user_id=current_user.id)
    track_earnings = next((t for t in earnings.tracks if t.track_id == track.id), None)
    if track_earnings and track_earnings.net_revenue > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"This track has earned ${track_earnings.net_revenue:.2f} — deleting it would "
                "remove that from your balance. Unpublish it instead to take it down without "
                "losing that history."
            ),
        )

    await _takedown_live_distributions(db, track, current_user, permanent=True)

    for url in (track.file_url, track.cover_art_url):
        file_key = storage.file_key_from_url(url)
        if file_key:
            try:
                storage.delete_file(file_key)
            except Exception:
                logger.warning("Failed to delete storage file %s for track %s", file_key, track.id, exc_info=True)

    track_crud.delete_track(db, track=track)
    return None
