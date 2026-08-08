# backend/app/api/ai_features.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pathlib import Path

from .deps import get_db
from ..models import Track

# Import ML Engines
from ..ml.metadata.infer_metadata import MetadataInferenceEngine
from ..ml.insights.infer_insights import PerformanceInsightEngine
from ..ml.territory.infer_territory import TerritoryInferenceEngine
from ..ml.release_timing.infer_timing import ReleaseTimingInferenceEngine
from ..ml.release_timing.schemas import ReleaseTimingRequest
from ..services.analytics_adapter import fetch_track_time_series_from_db, fetch_track_india_analytics_from_db

router = APIRouter(prefix="/ai", tags=["AI & ML Engines"])

# Resolve model paths relative to the backend package so imports work from
# both repo-root and backend working directories.
_BACKEND_DIR = Path(__file__).resolve().parents[2]


def _model_dir(name: str) -> str:
    return str(_BACKEND_DIR / "ml_models" / name)


# Instantiate Engines (Singleton Pattern for fast CPU/GPU inference)
metadata_engine = MetadataInferenceEngine(model_dir=_model_dir("metadata"))
insights_engine = PerformanceInsightEngine(model_dir=_model_dir("insights"), use_llm=True)
territory_engine = TerritoryInferenceEngine(model_dir=_model_dir("territory"))
timing_engine = ReleaseTimingInferenceEngine()


@router.post("/metadata-suggest/{track_id}")
def get_metadata_suggestions(track_id: str, db: Session = Depends(get_db)):
    """Powers <AIMetadataSuggestor.tsx />"""
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    res = metadata_engine.predict(
        track_id=str(track.id),
        audio_path=getattr(track, "file_url", None),
        title=track.title,
        existing_tags=getattr(track, "tags", None) or ([track.genre] if track.genre else []),
        existing_language=getattr(track, "language", None),
        lyrics=getattr(track, "lyrics", None),
    )
    
    track.ai_analysis = res.ai_analysis_payload
    db.commit()
    return res


@router.get("/performance-insights/{track_id}")
def get_performance_insights(track_id: str, db: Session = Depends(get_db)):
    """Powers <SmartInsightCard.tsx />"""
    time_series = fetch_track_time_series_from_db(track_id, db)
    insights = insights_engine.generate_insights(time_series)
    return [i.model_dump() for i in insights]


@router.get("/territory-growth/{track_id}")
def get_territory_growth_map(track_id: str, db: Session = Depends(get_db)):
    """Powers <TerritoryGrowthMap.tsx />"""
    india_analytics = fetch_track_india_analytics_from_db(track_id, db)
    res = territory_engine.predict_growth_areas(india_analytics, top_n=3)
    return res


@router.post("/release-timer")
def get_release_timing_recommendation(request: ReleaseTimingRequest):
    """Powers <ReleaseTimerDial.tsx />"""
    return timing_engine.recommend_release_timing(request)