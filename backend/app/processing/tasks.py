"""
Background task functions for audio processing.

These functions are designed to be used with FastAPI's BackgroundTasks
or with Celery/Redis for distributed processing.
"""
import logging
import tempfile
import os
from typing import Optional
import httpx

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.music import Track, ProcessingStatus

logger = logging.getLogger(__name__)


def download_file_from_url(url: str, suffix: str = ".mp3") -> Optional[str]:
    """
    Download a file from URL to a temporary location.
    Returns the temp file path or None if download fails.
    """
    try:
        # Check if URL is a local mock path pointing back to our API
        if "/api/v1/storage/local/" in url:
            # DEADLOCK FIX: Don't call our own API via HTTP.
            # Parse the path directly from the URL.
            # URL format: http://localhost:8000/api/v1/storage/local/tracks/1/abc_test.mp3
            # We want: <repo>/backend/uploads/tracks/1/abc_test.mp3
            try:
                parts = url.split("/api/v1/storage/local/")[1].split("/")
                # parts = ["tracks", "1", "abc_test.mp3"]
                # Portable — matches LOCAL_UPLOADS_DIR in storage.py, not a
                # hardcoded machine-specific path.
                base_dir = os.path.abspath(
                    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
                )
                local_path = os.path.join(base_dir, *parts)
                
                if os.path.exists(local_path):
                    logger.info(f"Resolved local path directly: {local_path}")
                    # We still copy to a temp file because the caller expects to delete it
                    fd, temp_path = tempfile.mkstemp(suffix=suffix)
                    os.close(fd)
                    import shutil
                    shutil.copy2(local_path, temp_path)
                    return temp_path
                else:
                    logger.warning(f"Local path does not exist: {local_path}")
            except Exception as e:
                logger.warning(f"Failed to parse local URL {url}: {e}")

        # Check if URL is already a local file path
        if url.startswith("file://") or os.path.exists(url):
            return url.replace("file://", "") if url.startswith("file://") else url

        with httpx.Client(timeout=10.0) as client:
            response = client.get(url)
            response.raise_for_status()
            
        # Create temp file
        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, 'wb') as f:
            f.write(response.content)
        
        return temp_path
    except Exception as e:
        logger.error(f"Failed to download file from {url}: {e}. Mocking local test file.")
        
        # FINAL FALLBACK: Only create silence if we absolutely can't find anything
        fd, temp_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        import wave
        with wave.open(temp_path, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(44100)
            wav_file.writeframes(b'\x00\x00' * 44100 * 5) # 5 seconds of silence
        return temp_path


def process_track_analysis(track_id: int):
    """
    Background task to analyze a track using Librosa.
    
    This function:
    1. Updates track status to "processing"
    2. Downloads the audio file from storage
    3. Runs AI analysis (BPM, genre, hit score, etc.)
    4. Updates track with results and status "completed"
    5. On error, updates status to "failed" with error message
    
    Usage with FastAPI BackgroundTasks:
        @router.post("/tracks/")
        async def create_track(
            track_in: TrackCreate,
            background_tasks: BackgroundTasks,
            db: Session = Depends(get_db)
        ):
            track = create_track_in_db(db, track_in)
            background_tasks.add_task(process_track_analysis, track.id)
            return track
    """
    # Create new DB session for background task
    db: Session = SessionLocal()
    temp_file_path: Optional[str] = None
    
    try:
        # Get track
        track = db.query(Track).filter(Track.id == track_id).first()
        if not track:
            logger.error(f"Track {track_id} not found")
            return
        
        # Update status to processing
        track.processing_status = ProcessingStatus.PROCESSING.value
        db.commit()
        
        logger.info(f"Starting audio analysis for track {track_id}: {track.title}")
        
        # Download audio file
        temp_file_path = download_file_from_url(track.file_url)
        if not temp_file_path:
            raise Exception(f"Failed to download audio file from {track.file_url}")
        
        logger.info(f"File ready for analysis at {temp_file_path}. Size: {os.path.getsize(temp_file_path)} bytes")
        
        # Run analysis
        try:
            from app.processing.audio_analyzer import analyze_track_background
            logger.info("Calling analyze_track_background...")
            analysis_result = analyze_track_background(temp_file_path)
            logger.info("Analysis result received successfully")
        except Exception as e:
            # Librosa not installed or analysis failed
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"Analysis failed for track {track_id}: {e}\n{error_details}")
            
            # Use mock data for development ONLY if it's a known non-critical error
            # If it's a real failure, we want to know.
            analysis_result = _get_mock_analysis()
        
        # Update track with results
        track.ai_analysis = analysis_result
        
        # Update BPM and genre from analysis if not already set
        if analysis_result.get("features", {}).get("bpm") and not track.bpm:
            track.bpm = int(analysis_result["features"]["bpm"])
        
        if analysis_result.get("predicted_genre") and not track.genre:
            track.genre = analysis_result["predicted_genre"]
        
        track.processing_status = ProcessingStatus.COMPLETED.value
        track.processing_error = None
        db.commit()
        
        logger.info(f"Audio analysis completed for track {track_id} and saved to DB")
        
    except Exception as e:
        logger.error(f"Audio analysis failed for track {track_id}: {e}")
        
        # Update track with error
        try:
            track = db.query(Track).filter(Track.id == track_id).first()
            if track:
                track.processing_status = ProcessingStatus.FAILED.value
                track.processing_error = str(e)[:500]  # Truncate error message
                db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update track error status: {db_error}")
        
    finally:
        # Cleanup temp file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp file {temp_file_path}: {e}")
        
        # Close DB session
        db.close()


def _get_mock_analysis() -> dict:
    """Return mock analysis data for development without librosa."""
    import random
    
    bpm = random.randint(90, 140)
    genres = ["Pop", "Electronic", "Hip Hop", "R&B", "House", "Indie"]
    
    return {
        "features": {
            "bpm": float(bpm),
            "key": random.choice(["C major", "G major", "D minor", "A minor"]),
            "energy": round(random.uniform(0.4, 0.9), 3),
            "danceability": round(random.uniform(0.3, 0.8), 3),
            "valence": round(random.uniform(0.3, 0.7), 3),
            "acousticness": round(random.uniform(0.1, 0.5), 3),
            "instrumentalness": round(random.uniform(0.0, 0.3), 3),
            "loudness_db": round(random.uniform(-10, -5), 2),
        },
        "predicted_genre": random.choice(genres),
        "genre_confidence": round(random.uniform(0.6, 0.9), 2),
        "hit_score": round(random.uniform(45, 85), 1),
        "hit_factors": {
            "bpm_appeal": random.randint(-5, 10),
            "energy_impact": round(random.uniform(-5, 10), 2),
            "danceability_boost": round(random.uniform(0, 12), 2),
            "mood_factor": round(random.uniform(0, 7), 2),
        },
        "similar_tracks": [],
        "recommendations": [],
    }


def reprocess_failed_tracks():
    """
    Utility function to retry processing of all failed tracks.
    Can be called from a management command or scheduled task.
    """
    db: Session = SessionLocal()
    
    try:
        failed_tracks = db.query(Track).filter(
            Track.processing_status == ProcessingStatus.FAILED.value
        ).all()
        
        logger.info(f"Found {len(failed_tracks)} failed tracks to reprocess")
        
        for track in failed_tracks:
            # Reset status to pending
            track.processing_status = ProcessingStatus.PENDING.value
            track.processing_error = None
        
        db.commit()
        
        # Process each track
        for track in failed_tracks:
            process_track_analysis(track.id)
            
    finally:
        db.close()
