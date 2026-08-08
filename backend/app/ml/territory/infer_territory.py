import os
import json
import joblib
import numpy as np
from typing import List, Dict, Any

from .schemas import (
    TrackIndiaTerritoryAnalytics,
    IndiaTerritoryGrowthResponse,
    IndiaFocusArea,
    IndianPlatformType
)
from .feature_extraction import IndiaTerritoryFeatureExtractor
from .strategy_generator import IndiaStrategyEngine


class TerritoryInferenceEngine:
    def __init__(self, model_dir: str = "models/territory"):
        self.feature_extractor = IndiaTerritoryFeatureExtractor()
        self.strategy_engine = IndiaStrategyEngine()

        model_path = os.path.join(model_dir, "territory_model.joblib")
        manifest_path = os.path.join(model_dir, "manifest.json")

        if os.path.exists(model_path) and os.path.exists(manifest_path):
            self.model = joblib.load(model_path)
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            self.feature_names = manifest["feature_names"]
        else:
            self.model = None

    def predict_growth_areas(
        self,
        analytics: TrackIndiaTerritoryAnalytics,
        top_n: int = 3
    ) -> IndiaTerritoryGrowthResponse:
        
        has_min_data, features_list = self.feature_extractor.extract_region_platform_features(analytics)

        if not has_min_data or not features_list:
            return IndiaTerritoryGrowthResponse(
                track_id=analytics.track_id,
                minimum_data_met=False,
                top_focus_areas=[],
                summary="Insufficient stream data (< 100 streams) to generate reliable regional opportunity scores.",
                ai_analysis_payload={"minimum_data_met": False}
            )

        focus_areas: List[IndiaFocusArea] = []

        for feats in features_list:
            if self.model is not None:
                vec = np.array([[feats[k] for k in self.feature_names]])
                opp_score = float(np.clip(self.model.predict(vec)[0], 0.0, 100.0))
            else:
                opp_score = float(np.clip(feats["wow_growth"] * 30.0 + feats["save_rate"] * 300.0, 0.0, 100.0))

            drivers = []
            if feats["wow_growth"] > 0.25:
                drivers.append(f"Strong WoW Stream Growth (+{feats['wow_growth']:.0%})")
            if feats["reels_velocity"] > 0.30:
                drivers.append(f"High Instagram Reels Audio Velocity (+{feats['reels_velocity']:.0%})")
            if feats["save_rate"] > 0.04:
                drivers.append(f"High Listener Save Rate ({feats['save_rate']:.1%})")

            if not drivers:
                drivers.append("Consistent baseline organic stream volume")

            strategy = self.strategy_engine.generate_strategy(
                region_code=feats["region_code"],
                region_name=feats["region_name"],
                platform=feats["platform"],
                features=feats
            )

            focus_areas.append(IndiaFocusArea(
                region_code=feats["region_code"],
                region_name=feats["region_name"],
                primary_platform=feats["platform"],
                opportunity_score=round(opp_score, 1),
                confidence=0.88,
                key_drivers=drivers,
                actionable_strategy=strategy
            ))

        focus_areas.sort(key=lambda x: x.opportunity_score, reverse=True)
        top_focus = focus_areas[:top_n]

        summary = f"Identified top {len(top_focus)} high-growth regional focus areas in India based on streaming velocity and engagement."

        ai_payload = {
            "minimum_data_met": True,
            "top_focus_areas": [f.model_dump() for f in top_focus],
            "summary": summary
        }

        return IndiaTerritoryGrowthResponse(
            track_id=analytics.track_id,
            minimum_data_met=True,
            top_focus_areas=top_focus,
            summary=summary,
            ai_analysis_payload=ai_payload
        )