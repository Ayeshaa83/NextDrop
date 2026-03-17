import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, ForeignKey, Integer, Float, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.music import Track

class TrackAnalytics(Base):
    __tablename__ = "track_analytics"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id"))
    stream_count: Mapped[int] = mapped_column(Integer, default=0)
    save_count: Mapped[int] = mapped_column(Integer, default=0)
    share_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # AI-Generated Insights
    hit_score: Mapped[float] = mapped_column(Float, nullable=True) # 0.0 to 100.0
    viral_velocity: Mapped[float] = mapped_column(Float, nullable=True)
    sentiment_data: Mapped[dict] = mapped_column(JSON, nullable=True) # For vibe analysis
    
    last_updated: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    track: Mapped["Track"] = relationship()

class RevenuePrediction(Base):
    __tablename__ = "revenue_predictions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"))
    predicted_monthly_revenue: Mapped[float] = mapped_column(Float)
    confidence_interval: Mapped[float] = mapped_column(Float)
    calculation_date: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())