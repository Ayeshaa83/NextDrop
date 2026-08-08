import os
from typing import Dict, Any
from .schemas import (
    ReleaseTimingRequest,
    ReleaseTimingResponse,
    ReleaseWindowOption
)
from .timing_scorer import ReleaseTimingScorer
from .strategy_generator import ReleaseChecklistEngine


class ReleaseTimingInferenceEngine:
    """Production Inference Engine for Release Timing Recommendations."""

    def __init__(self):
        self.scorer = ReleaseTimingScorer()
        self.checklist_engine = ReleaseChecklistEngine()

    def recommend_release_timing(self, request: ReleaseTimingRequest) -> ReleaseTimingResponse:
        
        editorial_eligible, windows = self.scorer.score_release_windows(
            genre=request.genre,
            target_market=request.target_market,
            lead_time_days=request.planned_lead_time_days
        )

        # Attach marketing checklist to each option
        for w in windows:
            w.marketing_checklist = self.checklist_engine.generate_checklist(
                day_of_week=w.day_of_week,
                recommended_time_ist=w.recommended_time_ist,
                lead_time_days=request.planned_lead_time_days,
                target_market=request.target_market
            )

        optimal_window = windows[0]
        alternative_windows = windows[1:]

        if editorial_eligible:
            summary = f"Optimal release window: {optimal_window.day_of_week.value} at {optimal_window.recommended_time_ist}. Lead time ({request.planned_lead_time_days} days) is optimal for editorial playlist pitching."
        else:
            summary = f"Optimal release window: {optimal_window.day_of_week.value} at {optimal_window.recommended_time_ist}. ⚠️ Warning: Lead time ({request.planned_lead_time_days} days) is below the 14-day recommendation for Spotify pitch consideration."

        ai_payload = {
            "editorial_pitch_eligible": editorial_eligible,
            "optimal_window": optimal_window.model_dump(),
            "alternative_windows": [w.model_dump() for w in alternative_windows],
            "summary": summary
        }

        return ReleaseTimingResponse(
            track_id=request.track_id,
            target_market=request.target_market,
            lead_time_days=request.planned_lead_time_days,
            editorial_pitch_eligible=editorial_eligible,
            optimal_window=optimal_window,
            alternative_windows=alternative_windows,
            summary=summary,
            ai_analysis_payload=ai_payload
        )