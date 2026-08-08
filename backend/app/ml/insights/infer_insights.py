import os
import json
import joblib
import numpy as np
from typing import List, Dict, Any

from .schemas import (
    TrackAnalyticsTimeSeries,
    PerformanceInsight,
    InsightType,
    InsightCategory
)
from .feature_extraction import AnalyticsFeatureExtractor
from .rule_engine import StageARuleEngine
from .nl_generator import TemplateNLGenerator


class PerformanceInsightEngine:
    """Unified Hybrid Pipeline: Stage A (Rules) + Stage B (Classifier) + Stage C (NL Template)."""

    def __init__(self, model_dir: str = "models/insights", use_llm: bool = False):
        # use_llm is accepted for backward compatibility with existing callers/tests.
        self.use_llm = use_llm
        self.feature_extractor = AnalyticsFeatureExtractor()
        self.rule_engine = StageARuleEngine()

        if use_llm:
            from .llm_generator import HuggingFaceInsightGenerator
            self.nl_generator = HuggingFaceInsightGenerator()
        else:
            # TemplateNLGenerator already imported at module level (line 15)
            self.nl_generator = TemplateNLGenerator()

        model_path = os.path.join(model_dir, "insights_model.joblib")
        manifest_path = os.path.join(model_dir, "manifest.json")

        if os.path.exists(model_path) and os.path.exists(manifest_path):
            self.clf = joblib.load(model_path)
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            
            self.feature_names = manifest["feature_names"]
            self.classes = manifest["classes"]
            self.category_map = manifest["insight_categories"]
        else:
            self.clf = None

    def generate_insights(
        self,
        time_series: TrackAnalyticsTimeSeries,
        max_insights: int = 3
    ) -> List[PerformanceInsight]:
        
        # 1. Extract Summary Features
        features = self.feature_extractor.extract_features(time_series)
        insights: List[PerformanceInsight] = []

        # 2. Stage A: Business Rules Evaluation
        rule_insights = self.rule_engine.evaluate_rules(features)
        insights.extend(rule_insights)

        # 3. Stage B: Supervised Model Prediction
        if self.clf is not None:
            feat_vector = np.array([[features[k] for k in self.feature_names]])
            probs = self.clf.predict_proba(feat_vector)[0]
            
            top_classes = np.argsort(probs)[::-1]

            for cls_idx in top_classes:
                confidence = float(probs[cls_idx])
                if confidence < 0.20:
                    continue

                insight_type_str = self.classes[cls_idx]
                try:
                    insight_type = InsightType(insight_type_str)
                except ValueError:
                    continue

                cat_str = self.category_map.get(insight_type_str, InsightCategory.GROWTH_TRAJECTORY.value)
                category = InsightCategory(cat_str)

                if any(i.category == category for i in insights):
                    continue

                # Stage C: Generate NL text from template
                ml_insight = self.nl_generator.generate_insight(
                    insight_type=insight_type,
                    category=category,
                    confidence=confidence,
                    metrics=features
                )
                insights.append(ml_insight)

        insights.sort(key=lambda x: x.confidence, reverse=True)
        return insights[:max_insights]