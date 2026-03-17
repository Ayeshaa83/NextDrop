from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.crud import analytics as analytics_crud
from app.crud import artist as artist_crud
from app.crud import track as track_crud
from app.schemas.analytics import TrackAnalyticsResponse, RevenuePredictionResponse, DashboardResponse
from app.models import User

router = APIRouter()

def get_current_artist(db: Session, current_user: User):
    """Helper to get current user's artist profile."""
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=400,
            detail="You need an artist profile to view analytics."
        )
    return artist

@router.get("/tracks/{track_id}", response_model=TrackAnalyticsResponse)
def get_track_analytics(
    track_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get analytics for a specific track."""
    artist = get_current_artist(db, current_user)
    
    # Verify track ownership
    track = track_crud.get_track_by_id(db, track_id=track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this track's analytics")
    
    analytics = analytics_crud.get_analytics_by_track_id(db, track_id=track_id)
    if not analytics:
        # Create analytics if they don't exist
        analytics = analytics_crud.create_or_update_analytics(db, track_id=track_id)
    
    return analytics

@router.get("/revenue", response_model=RevenuePredictionResponse)
def get_revenue_prediction(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get revenue prediction for the current artist."""
    artist = get_current_artist(db, current_user)
    
    prediction = analytics_crud.get_revenue_prediction(db, artist_id=artist.id)
    if not prediction:
        # Generate a prediction based on current streams
        all_analytics = analytics_crud.get_all_analytics_for_artist(db, artist_id=artist.id)
        total_streams = sum(a.stream_count for a in all_analytics)
        prediction = analytics_crud.create_revenue_prediction(db, artist_id=artist.id, total_streams=total_streams)
    
    return prediction

@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get aggregated dashboard analytics for the current artist."""
    artist = get_current_artist(db, current_user)
    return analytics_crud.get_dashboard_data(db, artist_id=artist.id)

@router.post("/tracks/{track_id}/simulate")
def simulate_track_activity(
    track_id: int,
    streams: int = 1000,
    saves: int = 50,
    shares: int = 25,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Simulate track activity (for demo purposes). Updates analytics with mock data."""
    artist = get_current_artist(db, current_user)
    
    track = track_crud.get_track_by_id(db, track_id=track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get existing analytics and add to them
    existing = analytics_crud.get_analytics_by_track_id(db, track_id=track_id)
    current_streams = existing.stream_count if existing else 0
    current_saves = existing.save_count if existing else 0
    current_shares = existing.share_count if existing else 0
    
    analytics = analytics_crud.create_or_update_analytics(
        db,
        track_id=track_id,
        stream_count=current_streams + streams,
        save_count=current_saves + saves,
        share_count=current_shares + shares
    )
    
    return {
        "message": "Activity simulated",
        "track_id": track_id,
        "new_hit_score": analytics.hit_score,
        "new_viral_velocity": analytics.viral_velocity,
        "total_streams": analytics.stream_count
    }
