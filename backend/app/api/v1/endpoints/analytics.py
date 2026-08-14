from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.crud import analytics as analytics_crud
from app.crud import artist as artist_crud
from app.crud import track as track_crud
from app.schemas.analytics import TrackAnalyticsResponse, RevenuePredictionResponse, DashboardResponse
from app.models import User, TrackDistribution, DistributionStatus, SocialAccount
from app.platforms.registry import registry
from app.sec.encryption import decrypt_token
from datetime import datetime

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


@router.get("/timeseries")
def get_streams_timeseries(
    days: int = 30,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Daily stream counts (total + per platform) for the streams-over-time chart."""
    artist = get_current_artist(db, current_user)
    days = max(7, min(days, 365))
    return {"days": days, "points": analytics_crud.get_timeseries(db, artist_id=artist.id, days=days)}


@router.get("/territories")
def get_territory_breakdown(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Country-level stream totals with 30-day growth."""
    artist = get_current_artist(db, current_user)
    return {"territories": analytics_crud.get_territories(db, artist_id=artist.id)}

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

    # Feed the time-series chart too (simulated streams count as 'other')
    other_total = max(
        0,
        analytics.stream_count - (analytics.youtube_views or 0) - (analytics.spotify_streams or 0),
    )
    analytics_crud.record_snapshot(db, track_id, "other", other_total)

    return {
        "message": "Activity simulated",
        "track_id": track_id,
        "new_hit_score": analytics.hit_score,
        "new_viral_velocity": analytics.viral_velocity,
        "total_streams": analytics.stream_count
    }

@router.post("/tracks/{track_id}/refresh-platforms", response_model=TrackAnalyticsResponse)
async def refresh_platform_analytics(
    track_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Fetch real analytics from all platforms a track is distributed to.
    """
    artist = get_current_artist(db, current_user)
    track = track_crud.get_track_by_id(db, track_id=track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.artist_id != artist.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    distributions = db.query(TrackDistribution).filter(
        TrackDistribution.track_id == track_id,
        TrackDistribution.status == DistributionStatus.LIVE.value
    ).all()
    
    analytics = analytics_crud.get_analytics_by_track_id(db, track_id=track_id)
    if not analytics:
        analytics = analytics_crud.create_or_update_analytics(db, track_id=track_id)
        
    for dist in distributions:
        adapter = registry.get_adapter(dist.platform)
        if not adapter or not adapter.supports_analytics:
            continue
            
        account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.provider == dist.platform
        ).first()
        
        if not account:
            continue
            
        try:
            # Auto-refresh token if expired
            if account.expires_at and account.expires_at < datetime.utcnow():
                new_tokens = await adapter.refresh_token(account)
                for k, v in new_tokens.items():
                    if hasattr(account, k) and v is not None:
                        setattr(account, k, v)
                account.updated_at = datetime.utcnow()
                db.commit()
                
            # Decrypt tokens before passing to the adapter
            account.access_token = decrypt_token(account.access_token)
            if account.refresh_token:
                account.refresh_token = decrypt_token(account.refresh_token)
                
            stats = await adapter.get_track_analytics(dist.platform_track_id, account)

            if dist.platform == "youtube":
                analytics.youtube_views = stats.views or 0
                analytics.youtube_likes = stats.likes or 0
                analytics.youtube_comments = stats.comments or 0
                # Record the daily delta for the streams-over-time chart
                analytics_crud.record_snapshot(
                    db, track_id, "youtube", analytics.youtube_views, commit=False
                )

            elif dist.platform == "spotify":
                # streams/saves are always None via the public Web API (no
                # distributor partnership) — popularity (0-100) is the one
                # real per-track metric it actually exposes.
                analytics.spotify_streams = stats.streams or 0
                analytics.spotify_saves = stats.saves or 0
                analytics.spotify_popularity = stats.raw.get("popularity")
                analytics_crud.record_snapshot(
                    db, track_id, "spotify", analytics.spotify_streams, commit=False
                )

            # Update total aggregates
            analytics.stream_count = (analytics.youtube_views or 0) + (analytics.spotify_streams or 0)
            analytics.save_count = (analytics.youtube_likes or 0) + (analytics.spotify_saves or 0)

            # A successful check should always read as "just checked", even
            # when the platform reports the same numbers as last time — the
            # onupdate on last_updated only fires when a column actually
            # changes, which otherwise left this looking falsely stale.
            analytics.last_updated = datetime.utcnow()

        except Exception as e:
            # Skip this platform if stats fail, move to next
            print(f"Failed to fetch {dist.platform} stats for track {track_id}: {e}")
            continue
            
    db.commit()
    db.refresh(analytics)
    return analytics

