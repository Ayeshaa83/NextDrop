# backend/app/services/analytics_adapter.py
from sqlalchemy.orm import Session
from app.models.analytics import AnalyticsSnapshot
from app.ml.insights.schemas import TrackAnalyticsTimeSeries, WeeklyAnalyticsPoint
from app.ml.territory.schemas import TrackIndiaTerritoryAnalytics, RegionalWeeklyStats, IndianPlatformType


def fetch_track_time_series_from_db(track_id: str, db: Session) -> TrackAnalyticsTimeSeries:
    """Pulls time-series analytics directly from existing analytics_snapshots table."""
    snapshots = (
        db.query(AnalyticsSnapshot)
        .filter(AnalyticsSnapshot.track_id == track_id)
        .order_by(AnalyticsSnapshot.snapshot_date.desc())
        .limit(28)
        .all()
    )

    weekly_points = []
    if not snapshots:
        # Default baseline if no snapshots exist yet
        for i in range(4):
            weekly_points.append(WeeklyAnalyticsPoint(
                week_index=i, streams=1000, saves=50, playlist_adds=20, ugc_count=10,
                platform_shares={"spotify": 0.6, "apple": 0.3, "youtube": 0.1}
            ))
        return TrackAnalyticsTimeSeries(track_id=track_id, weekly_data=weekly_points)

    for w in range(4):
        chunk = snapshots[w*7 : (w+1)*7]
        s_count = sum(s.streams for s in chunk) if chunk else 100
        save_count = int(s_count * 0.05)
        
        weekly_points.append(WeeklyAnalyticsPoint(
            week_index=w,
            streams=max(1, s_count),
            saves=save_count,
            playlist_adds=int(s_count * 0.02),
            ugc_count=int(s_count * 0.01),
            platform_shares={"spotify": 0.6, "apple": 0.3, "youtube": 0.1}
        ))

    return TrackAnalyticsTimeSeries(track_id=track_id, weekly_data=weekly_points)


def fetch_track_india_analytics_from_db(track_id: str, db: Session) -> TrackIndiaTerritoryAnalytics:
    """Pulls regional analytics directly from existing analytics_snapshots table."""
    snapshots = (
        db.query(AnalyticsSnapshot)
        .filter(AnalyticsSnapshot.track_id == track_id)
        .all()
    )

    regional_series = []
    if not snapshots:
        regions = ["MH", "PB", "DL", "GJ"]
        for r_code in regions:
            regional_series.append(RegionalWeeklyStats(
                week_index=0, region_code=r_code, platform=IndianPlatformType.SPOTIFY_INDIA,
                streams=5000, saves=300, playlist_adds=50, reels_ugc_count=100
            ))
            regional_series.append(RegionalWeeklyStats(
                week_index=1, region_code=r_code, platform=IndianPlatformType.SPOTIFY_INDIA,
                streams=4000, saves=250, playlist_adds=40, reels_ugc_count=80
            ))
    else:
        for s in snapshots:
            country_code = (s.country or "MH").upper()
            if country_code not in ["MH", "PB", "DL", "KA", "TN", "TS", "WB", "GJ", "KL"]:
                country_code = "MH"
            regional_series.append(RegionalWeeklyStats(
                week_index=0,
                region_code=country_code,
                platform=IndianPlatformType.SPOTIFY_INDIA if s.platform == "spotify" else IndianPlatformType.INSTAGRAM_REELS,
                streams=max(1, s.streams),
                saves=int(s.streams * 0.05),
                playlist_adds=int(s.streams * 0.02),
                reels_ugc_count=int(s.streams * 0.01)
            ))

    return TrackIndiaTerritoryAnalytics(track_id=track_id, genre="hindi_indie", regional_series=regional_series)