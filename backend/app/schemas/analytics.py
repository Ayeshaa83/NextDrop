from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class TrackAnalyticsResponse(BaseModel):
    id: int
    track_id: int
    stream_count: int
    save_count: int
    share_count: int
    hit_score: Optional[float] = None
    viral_velocity: Optional[float] = None
    sentiment_data: Optional[Dict[str, Any]] = None
    last_updated: datetime

    # Per-platform — real data, kept separate rather than only the merged
    # totals above, since YouTube and Spotify measure genuinely different
    # things (YouTube: views/likes/comments; Spotify: a 0-100 popularity
    # score, the only per-track metric its public API exposes).
    youtube_views: int = 0
    youtube_likes: int = 0
    youtube_comments: int = 0
    spotify_popularity: Optional[int] = None

    class Config:
        from_attributes = True

class RevenuePredictionResponse(BaseModel):
    id: int
    artist_id: int
    predicted_monthly_revenue: float
    confidence_interval: float
    calculation_date: datetime

    class Config:
        from_attributes = True

class DashboardResponse(BaseModel):
    total_streams: int
    total_saves: int
    total_shares: int
    average_hit_score: Optional[float]
    top_track_id: Optional[int]
    monthly_revenue_prediction: Optional[float]
    platform_breakdown: Optional[Dict[str, int]] = None
