from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.crud import track as track_crud
from app.crud import artist as artist_crud
from app.schemas.track import (
    TrackCreate, TrackUpdate, TrackResponse, 
    TrackProcessingStatus, AIAnalysisResponse,
    AnalyzeFileResponse
)
from app.models import User
from app.processing.tasks import process_track_analysis
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

        # ── Run Musicnn tagger (subprocess, isolated) ──────────────────
        musicnn_result = None
        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
            from ai_engine.runner import run_musicnn_tagger
            musicnn_result = run_musicnn_tagger(temp_path)
            logger.info(f"Musicnn result: {len(musicnn_result.get('tags_raw', []))} tags")
        except Exception as e:
            logger.warning(f"Musicnn tagger failed (non-fatal): {e}")
            musicnn_result = {
                "tags_raw": [], "genre": [], "style": [], "mood": [],
                "instruments": [], "vocals": [], "error": str(e)
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

@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_track(
    track_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Delete a track (only by owner)."""
    artist_id = get_current_artist_id(db, current_user)
    track = track_crud.get_track_by_id(db, track_id=track_id)
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this track")
    
    track_crud.delete_track(db, track=track)
    return None
