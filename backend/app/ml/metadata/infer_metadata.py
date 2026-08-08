import os
import json
import joblib
import numpy as np
from typing import Dict, Any, List, Optional

from .schemas import MetadataSuggestionResponse
from .taxonomy import TaxonomyNormalizer
from .extract_features import AudioFeatureExtractor
from .quality_scorer import MetadataQualityScorer
from .language_detector import SimpleLanguageDetector


class MetadataInferenceEngine:
    def __init__(self, model_dir: str = "models/metadata"):
        self.model_path = os.path.join(model_dir, "metadata_model.joblib")
        self.manifest_path = os.path.join(model_dir, "manifest.json")

        if not os.path.exists(self.model_path) or not os.path.exists(self.manifest_path):
            raise FileNotFoundError(f"Model artifacts missing from: {model_dir}")

        self.clf = joblib.load(self.model_path)
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.labels: List[str] = manifest["labels"]
        self.thresholds: Dict[str, float] = manifest["thresholds"]

        self.taxonomy = TaxonomyNormalizer()
        self.extractor = AudioFeatureExtractor()
        self.scorer = MetadataQualityScorer(self.taxonomy)
        self.lang_detector = SimpleLanguageDetector()

    def predict(
        self,
        track_id: str,
        audio_path: Optional[str] = None,
        title: str = "",
        existing_tags: List[str] = [],
        existing_language: Optional[str] = None,
        lyrics: Optional[str] = None,
        context_features: Optional[Dict[str, Any]] = None
    ) -> MetadataSuggestionResponse:

        # 1. Feature Extraction
        if audio_path and os.path.exists(audio_path):
            panns_emb, audio_features = self.extractor.extract_from_audio_file(audio_path)
        else:
            panns_emb = self.extractor.generate_synthetic_embedding(track_id)
            audio_features = self.extractor.generate_synthetic_descriptors(track_id)

        artist_id = context_features.get("artist_id", "") if context_features else ""
        feat_vector = self.extractor.assemble_vector(panns_emb, audio_features, artist_id=artist_id)

        # 2. Model Prediction
        prob_list = self.clf.predict_proba([feat_vector])

        predictions: Dict[str, float] = {}
        for i, label in enumerate(self.labels):
            p = prob_list[i][0]
            prob_val = float(p[1]) if len(p) == 2 else 0.0
            predictions[label] = round(prob_val, 4)

        # 3. Language Detection
        detected_lang, lang_conf = existing_language, 1.0
        if not detected_lang:
            detected_lang, lang_conf = self.lang_detector.detect_from_text(title, lyrics)

        # 4. Quality Scoring & Recommendations
        quality_score, suggestions, summary = self.scorer.evaluate(
            existing_tags=existing_tags,
            predictions=predictions,
            thresholds=self.thresholds,
            audio_features=audio_features,
            has_language=bool(detected_lang)
        )

        ai_payload = {
            "metadata_quality_score": quality_score,
            "predicted_language": detected_lang,
            "language_confidence": lang_conf,
            "predicted_probabilities": predictions,
            "suggested_actions": [s.model_dump() for s in suggestions],
            "audio_summary": audio_features
        }

        return MetadataSuggestionResponse(
            track_id=track_id,
            quality_score=quality_score,
            predicted_language=detected_lang,
            language_confidence=lang_conf,
            suggestions=suggestions,
            existing_tags=existing_tags,
            summary=summary,
            ai_analysis_payload=ai_payload
        )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run inference on a single track")
    parser.add_argument("--model-dir", default="models/metadata", help="Model directory")
    parser.add_argument("--track-id", default="track_771", help="Track ID")
    parser.add_argument("--title", default="Electric Dreams", help="Track title")
    parser.add_argument("--tags", nargs="*", default=["electronic"], help="Existing tags")
    
    args = parser.parse_args()

    engine = MetadataInferenceEngine(model_dir=args.model_dir)
    res = engine.predict(track_id=args.track_id, title=args.title, existing_tags=args.tags)
    
    print("\n=================== INFERENCE RESULT ===================")
    print(f"Track ID               : {res.track_id}")
    print(f"Metadata Quality Score : {res.quality_score} / 100")
    print(f"Predicted Language     : {res.predicted_language} (conf: {res.language_confidence})")
    print(f"Summary                : {res.summary}")
    print(f"\nSuggestions ({len(res.suggestions)} total):")
    for s in res.suggestions:
        print(f"  - [{s.action.upper()}] {s.category.value}: '{s.tag}' (conf: {s.confidence})")
        print(f"    Reason: {s.explanation}")
    print("==========================================================")