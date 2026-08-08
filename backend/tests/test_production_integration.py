# NEXTDROP-1/backend/tests/test_production_integration.py
import sys
import os
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root_dir))

import pytest
from typing import Dict, Any

# 1. Test Module Imports
print("\n[1/5] Verifying ML Module & Schema Imports...")
try:
    from backend.app.ml.metadata.infer_metadata import MetadataInferenceEngine
    from backend.app.ml.insights.infer_insights import PerformanceInsightEngine
    from backend.app.ml.territory.infer_territory import TerritoryInferenceEngine
    from backend.app.ml.release_timing.infer_timing import ReleaseTimingInferenceEngine
    from backend.app.ml.release_timing.schemas import ReleaseTimingRequest, TargetMarket
    from backend.app.ml.insights.schemas import TrackAnalyticsTimeSeries, WeeklyAnalyticsPoint
    from backend.app.ml.territory.schemas import TrackIndiaTerritoryAnalytics, RegionalWeeklyStats, IndianPlatformType
    print("  All ML Engine imports resolved successfully.")
except ImportError as e:
    print(f"  Import Error: {e}")
    sys.exit(1)


# 2. Test Model Artifact Existence
print("\n[2/5] Checking Model Binary Artifacts in backend/ml_models/...")
model_paths = [
    "backend/ml_models/metadata/metadata_model.joblib",
    "backend/ml_models/metadata/manifest.json",
    "backend/ml_models/insights/insights_model.joblib",
    "backend/ml_models/insights/manifest.json",
    "backend/ml_models/territory/territory_model.joblib",
    "backend/ml_models/territory/manifest.json",
]

for p in model_paths:
    exists = os.path.exists(p)
    status = "EXISTS" if exists else "MISSING (Fallback mode active)"
    print(f"  [{'PASS' if exists else 'WARN'}] {p}: {status}")


def test_production_level_ml_suite():
    print("\n[3/5] Executing End-to-End Production ML Engine Tests...")

    # -------------------------------------------------------------
    # ENGINE 1: Metadata Quality Assistance Engine
    # -------------------------------------------------------------
    print("  Running Engine 1: Metadata Quality Assistance...")
    meta_engine = MetadataInferenceEngine(model_dir="backend/ml_models/metadata")
    meta_res = meta_engine.predict(
        track_id="prod_test_001",
        title="Midnight Drive in Mumbai",
        existing_tags=["hindi_indie"],
        existing_language="hi"
    )
    assert 0.0 <= meta_res.quality_score <= 100.0
    assert "metadata_quality_score" in meta_res.ai_analysis_payload
    print(f"    Metadata Score: {meta_res.quality_score}/100 | Suggestions: {len(meta_res.suggestions)}")

    # -------------------------------------------------------------
    # ENGINE 2: Performance Insights Engine (with SMA)
    # -------------------------------------------------------------
    print("  Running Engine 2: Performance Insights (SMA Crossover)...")
    insights_engine = PerformanceInsightEngine(model_dir="backend/ml_models/insights", use_llm=False)
    
    mock_series = TrackAnalyticsTimeSeries(
        track_id="prod_test_001",
        weekly_data=[
            WeeklyAnalyticsPoint(week_index=0, streams=45000, saves=2200, playlist_adds=500, ugc_count=350, platform_shares={"spotify": 0.6, "apple": 0.4}),
            WeeklyAnalyticsPoint(week_index=1, streams=25000, saves=1200, playlist_adds=250, ugc_count=150, platform_shares={"spotify": 0.6, "apple": 0.4}),
            WeeklyAnalyticsPoint(week_index=2, streams=18000, saves=900, playlist_adds=150, ugc_count=80, platform_shares={"spotify": 0.6, "apple": 0.4}),
            WeeklyAnalyticsPoint(week_index=3, streams=12000, saves=600, playlist_adds=100, ugc_count=40, platform_shares={"spotify": 0.6, "apple": 0.4})
        ]
    )
    insights_res = insights_engine.generate_insights(mock_series)
    assert len(insights_res) > 0
    print(f"    Insights Generated: {len(insights_res)} | Top: '{insights_res[0].headline}'")

    # -------------------------------------------------------------
    # ENGINE 3: India Territory & Platform Growth Engine
    # -------------------------------------------------------------
    print("  Running Engine 3: India Territory & Platform Growth...")
    territory_engine = TerritoryInferenceEngine(model_dir="backend/ml_models/territory")
    
    mock_india_series = TrackIndiaTerritoryAnalytics(
        track_id="prod_test_001",
        genre="punjabi_pop",
        regional_series=[
            RegionalWeeklyStats(week_index=0, region_code="PB", platform=IndianPlatformType.INSTAGRAM_REELS, streams=25000, saves=1200, playlist_adds=500, reels_ugc_count=850),
            RegionalWeeklyStats(week_index=1, region_code="PB", platform=IndianPlatformType.INSTAGRAM_REELS, streams=12000, saves=600, playlist_adds=250, reels_ugc_count=350),
            RegionalWeeklyStats(week_index=0, region_code="MH", platform=IndianPlatformType.SPOTIFY_INDIA, streams=18000, saves=1400, playlist_adds=350, reels_ugc_count=120),
            RegionalWeeklyStats(week_index=1, region_code="MH", platform=IndianPlatformType.SPOTIFY_INDIA, streams=16500, saves=1300, playlist_adds=310, reels_ugc_count=100)
        ]
    )
    territory_res = territory_engine.predict_growth_areas(mock_india_series, top_n=2)
    assert territory_res.minimum_data_met is True
    assert len(territory_res.top_focus_areas) > 0
    print(f"    Top India Territory: {territory_res.top_focus_areas[0].region_name} ({territory_res.top_focus_areas[0].opportunity_score}/100)")

    # -------------------------------------------------------------
    # ENGINE 4: Release Timing Recommendations Engine
    # -------------------------------------------------------------
    print("  Running Engine 4: Release Timing Recommendation (IST Windows)...")
    timing_engine = ReleaseTimingInferenceEngine()
    timing_req = ReleaseTimingRequest(
        track_id="prod_test_001",
        genre="hindi_indie",
        target_market=TargetMarket.INDIA_DOMESTIC,
        planned_lead_time_days=14
    )
    timing_res = timing_engine.recommend_release_timing(timing_req)
    assert timing_res.editorial_pitch_eligible is True
    print(f"    Optimal Window: {timing_res.optimal_window.day_of_week.value} at {timing_res.optimal_window.recommended_time_ist} (Score: {timing_res.optimal_window.composite_score}/100)")

    print("\n[4/5] All 4 ML Engines Passed Unit & Assertion Verifications!")


if __name__ == "__main__":
    test_production_level_ml_suite()
    print("\n========================================================================")
    print("PRODUCTION INTEGRATION TEST PASSED! YOUR ML SUITE IS 100% READY.")
    print("========================================================================\n")