from sqlalchemy.orm import Session
from sqlalchemy import func
import random
from app.models import TrackAnalytics, RevenuePrediction, Track
from app.schemas.analytics import DashboardResponse

def get_analytics_by_track_id(db: Session, track_id: int):
    return db.query(TrackAnalytics).filter(TrackAnalytics.track_id == track_id).first()

def get_all_analytics_for_artist(db: Session, artist_id: int):
    """Get analytics for all tracks belonging to an artist."""
    return db.query(TrackAnalytics).join(Track).filter(Track.artist_id == artist_id).all()

def create_or_update_analytics(db: Session, track_id: int, stream_count: int = 0, 
                                save_count: int = 0, share_count: int = 0):
    existing = get_analytics_by_track_id(db, track_id)
    
    if existing:
        existing.stream_count = stream_count
        existing.save_count = save_count
        existing.share_count = share_count
        # Generate mock AI scores
        existing.hit_score = generate_mock_hit_score(stream_count, save_count, share_count)
        existing.viral_velocity = generate_mock_viral_velocity(share_count)
        db.commit()
        db.refresh(existing)
        return existing
    
    new_analytics = TrackAnalytics(
        track_id=track_id,
        stream_count=stream_count,
        save_count=save_count,
        share_count=share_count,
        hit_score=generate_mock_hit_score(stream_count, save_count, share_count),
        viral_velocity=generate_mock_viral_velocity(share_count),
        sentiment_data={"positive": 0.7, "neutral": 0.2, "negative": 0.1}
    )
    db.add(new_analytics)
    db.commit()
    db.refresh(new_analytics)
    return new_analytics

def generate_mock_hit_score(streams: int, saves: int, shares: int) -> float:
    """Generate a mock Hit Score (0-100) based on engagement."""
    base = min(50 + (streams / 10000) + (saves / 100) + (shares / 50), 100)
    return round(base + random.uniform(-5, 5), 1)

def generate_mock_viral_velocity(shares: int) -> float:
    """Generate mock Viral Velocity (shares per hour approximation)."""
    return round(shares / 24 + random.uniform(0, 100), 1)

def get_revenue_prediction(db: Session, artist_id: int):
    return db.query(RevenuePrediction).filter(
        RevenuePrediction.artist_id == artist_id
    ).order_by(RevenuePrediction.calculation_date.desc()).first()

def create_revenue_prediction(db: Session, artist_id: int, total_streams: int):
    """Generate a mock revenue prediction based on total streams."""
    # Mock revenue calculation: ~$3.5 per 1000 streams
    predicted_revenue = (total_streams / 1000) * 3.5
    confidence = min(0.95, 0.6 + (total_streams / 1000000) * 0.1)
    
    prediction = RevenuePrediction(
        artist_id=artist_id,
        predicted_monthly_revenue=round(predicted_revenue, 2),
        confidence_interval=round(confidence, 2)
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction

def get_dashboard_data(db: Session, artist_id: int) -> DashboardResponse:
    """Aggregate dashboard data for an artist."""
    analytics_list = get_all_analytics_for_artist(db, artist_id)
    
    total_streams = sum(a.stream_count for a in analytics_list)
    total_saves = sum(a.save_count for a in analytics_list)
    total_shares = sum(a.share_count for a in analytics_list)
    
    hit_scores = [a.hit_score for a in analytics_list if a.hit_score]
    avg_hit_score = sum(hit_scores) / len(hit_scores) if hit_scores else None
    
    top_track = max(analytics_list, key=lambda a: a.stream_count) if analytics_list else None
    
    revenue_pred = get_revenue_prediction(db, artist_id)
    
    return DashboardResponse(
        total_streams=total_streams,
        total_saves=total_saves,
        total_shares=total_shares,
        average_hit_score=round(avg_hit_score, 1) if avg_hit_score else None,
        top_track_id=top_track.track_id if top_track else None,
        monthly_revenue_prediction=revenue_pred.predicted_monthly_revenue if revenue_pred else None
    )
