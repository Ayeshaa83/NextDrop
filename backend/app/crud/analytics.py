import datetime

from sqlalchemy.orm import Session
from sqlalchemy import func
import random
from app.models import TrackAnalytics, RevenuePrediction, Track, AnalyticsSnapshot
from app.schemas.analytics import DashboardResponse

def get_analytics_by_track_id(db: Session, track_id: int):
    return db.query(TrackAnalytics).filter(TrackAnalytics.track_id == track_id).first()

def get_all_analytics_for_artist(db: Session, artist_id: int):
    """Get analytics for all of an artist's currently-public tracks.

    Feeds dashboard totals and revenue predictions — an unpublished track's
    past stream count shouldn't keep inflating those once it's taken down,
    even though the track's own analytics record is untouched (still visible
    on that track's own page, just not rolled into artist-wide aggregates)."""
    return (
        db.query(TrackAnalytics)
        .join(Track)
        .filter(Track.artist_id == artist_id, Track.is_public.is_(True))
        .all()
    )

def _ml_hit_score(db: Session, track_id: int) -> float | None:
    """Prefer the real XGBoost hit score from audio analysis when available."""
    track = db.query(Track).filter(Track.id == track_id).first()
    if track and isinstance(track.ai_analysis, dict):
        score = track.ai_analysis.get("hit_score")
        if isinstance(score, (int, float)):
            return round(float(score), 1)
    return None

def create_or_update_analytics(db: Session, track_id: int, stream_count: int = 0,
                                save_count: int = 0, share_count: int = 0):
    existing = get_analytics_by_track_id(db, track_id)
    hit_score = _ml_hit_score(db, track_id) or generate_mock_hit_score(stream_count, save_count, share_count)

    if existing:
        existing.stream_count = stream_count
        existing.save_count = save_count
        existing.share_count = share_count
        existing.hit_score = hit_score
        existing.viral_velocity = generate_mock_viral_velocity(share_count)
        db.commit()
        db.refresh(existing)
        return existing

    new_analytics = TrackAnalytics(
        track_id=track_id,
        stream_count=stream_count,
        save_count=save_count,
        share_count=share_count,
        hit_score=hit_score,
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

def create_revenue_prediction(db: Session, artist_id: int, total_streams: int,
                              spotify_streams: int = 0, youtube_views: int = 0):
    """
    Generate a revenue prediction using real per-platform payout rates.
    - Spotify: ~$0.004 per stream (industry average)
    - YouTube Content ID: ~$0.001 per view (ad-supported)
    - Generic fallback: ~$0.003 per stream for unknown sources
    """
    spotify_revenue = spotify_streams * 0.004
    youtube_revenue = youtube_views * 0.001
    
    # Streams not attributed to a known platform
    other_streams = max(0, total_streams - spotify_streams - youtube_views)
    other_revenue = other_streams * 0.003
    
    predicted_revenue = spotify_revenue + youtube_revenue + other_revenue
    
    # Confidence scales with volume (more data = more accurate prediction)
    confidence = min(0.95, 0.5 + min(total_streams, 1_000_000) / 2_000_000)
    
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
    
    youtube_total = sum((a.youtube_views or 0) for a in analytics_list)
    spotify_total = sum((a.spotify_streams or 0) for a in analytics_list)
    # Give generic baseline if empty so UI looks good in demo
    if youtube_total == 0 and spotify_total == 0:
        platform_breakdown = {"Spotify": 45, "Apple Music": 25, "YouTube": 15, "Instagram": 15}
    else:
        # Calculate real percentages
        total = youtube_total + spotify_total
        platform_breakdown = {
            "YouTube": round((youtube_total / total) * 100) if total > 0 else 0,
            "Spotify": round((spotify_total / total) * 100) if total > 0 else 0,
        }
    
    return DashboardResponse(
        total_streams=total_streams,
        total_saves=total_saves,
        total_shares=total_shares,
        average_hit_score=round(avg_hit_score, 1) if avg_hit_score else None,
        top_track_id=top_track.track_id if top_track else None,
        monthly_revenue_prediction=revenue_pred.predicted_monthly_revenue if revenue_pred else None,
        platform_breakdown=platform_breakdown
    )


# ============ TIME-SERIES SNAPSHOTS ============

def record_snapshot(db: Session, track_id: int, platform: str, cumulative_total: int,
                    country: str | None = None, commit: bool = True):
    """Record today's stream delta for a track+platform.

    `cumulative_total` is the platform's lifetime counter; the delta vs the
    sum of all previous snapshots is stored so charts can plot daily values.
    """
    recorded_so_far = db.query(func.coalesce(func.sum(AnalyticsSnapshot.streams), 0)).filter(
        AnalyticsSnapshot.track_id == track_id,
        AnalyticsSnapshot.platform == platform,
    ).scalar() or 0

    delta = max(0, (cumulative_total or 0) - recorded_so_far)
    if delta == 0:
        return None

    today = datetime.date.today()
    existing = db.query(AnalyticsSnapshot).filter(
        AnalyticsSnapshot.track_id == track_id,
        AnalyticsSnapshot.platform == platform,
        AnalyticsSnapshot.snapshot_date == today,
        AnalyticsSnapshot.country == country,
    ).first()

    if existing:
        existing.streams += delta
        snapshot = existing
    else:
        snapshot = AnalyticsSnapshot(
            track_id=track_id, platform=platform,
            snapshot_date=today, streams=delta, country=country,
        )
        db.add(snapshot)

    if commit:
        db.commit()
    return snapshot


def get_timeseries(db: Session, artist_id: int, days: int = 30):
    """Daily stream totals per platform for all of an artist's currently-public
    tracks — same is_public rule as the dashboard total, so the trajectory
    chart and the headline number never disagree with each other."""
    since = datetime.date.today() - datetime.timedelta(days=days - 1)
    rows = (
        db.query(
            AnalyticsSnapshot.snapshot_date,
            AnalyticsSnapshot.platform,
            func.sum(AnalyticsSnapshot.streams).label("streams"),
        )
        .join(Track, Track.id == AnalyticsSnapshot.track_id)
        .filter(
            Track.artist_id == artist_id,
            Track.is_public.is_(True),
            AnalyticsSnapshot.snapshot_date >= since,
        )
        .group_by(AnalyticsSnapshot.snapshot_date, AnalyticsSnapshot.platform)
        .order_by(AnalyticsSnapshot.snapshot_date)
        .all()
    )

    # Pivot into one point per day: {date, total, <platform>: n, ...}
    by_date: dict = {}
    for snap_date, platform, streams in rows:
        point = by_date.setdefault(snap_date, {"date": snap_date.isoformat(), "total": 0})
        point[platform] = point.get(platform, 0) + int(streams)
        point["total"] += int(streams)

    return [by_date[d] for d in sorted(by_date)]


def get_territories(db: Session, artist_id: int, days: int = 60):
    """Country-level stream totals with growth (last 30d vs previous 30d)."""
    today = datetime.date.today()
    current_start = today - datetime.timedelta(days=29)
    previous_start = today - datetime.timedelta(days=59)

    def totals(start, end):
        rows = (
            db.query(AnalyticsSnapshot.country, func.sum(AnalyticsSnapshot.streams))
            .join(Track, Track.id == AnalyticsSnapshot.track_id)
            .filter(
                Track.artist_id == artist_id,
                Track.is_public.is_(True),
                AnalyticsSnapshot.country.isnot(None),
                AnalyticsSnapshot.snapshot_date >= start,
                AnalyticsSnapshot.snapshot_date <= end,
            )
            .group_by(AnalyticsSnapshot.country)
            .all()
        )
        return {country: int(streams) for country, streams in rows}

    current = totals(current_start, today)
    previous = totals(previous_start, current_start - datetime.timedelta(days=1))

    territories = []
    for country, streams in current.items():
        prev = previous.get(country, 0)
        growth = round(((streams - prev) / prev) * 100, 1) if prev > 0 else (100.0 if streams else 0.0)
        territories.append({
            "country": country,
            "streams": streams,
            "previous_streams": prev,
            "growth_percentage": growth,
        })

    territories.sort(key=lambda t: t["streams"], reverse=True)
    return territories
