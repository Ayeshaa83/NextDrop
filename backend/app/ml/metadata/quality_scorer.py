from typing import List, Dict, Tuple
from .schemas import TagSuggestion, TagCategory, SuggestionAction
from .taxonomy import TaxonomyNormalizer


class MetadataQualityScorer:
    def __init__(self, taxonomy_normalizer: TaxonomyNormalizer):
        self.taxonomy = taxonomy_normalizer

    def evaluate(
        self,
        existing_tags: List[str],
        predictions: Dict[str, float],
        thresholds: Dict[str, float],
        audio_features: Dict[str, float],
        has_language: bool
    ) -> Tuple[float, List[TagSuggestion], str]:
        
        normalized_existing = set(self.taxonomy.normalize_tags(existing_tags))
        suggestions: List[TagSuggestion] = []
        score = 100.0
        
        if not has_language:
            score -= 10.0
        if not normalized_existing:
            score -= 25.0

        for tag, prob in predictions.items():
            thresh = thresholds.get(tag, 0.5)
            cat_str = self.taxonomy.get_category(tag)
            category = TagCategory(cat_str)

            if prob >= thresh and tag not in normalized_existing:
                explanation = self._generate_explanation(tag, prob, audio_features)
                suggestions.append(
                    TagSuggestion(
                        tag=tag,
                        category=category,
                        action=SuggestionAction.ADD,
                        confidence=round(prob, 3),
                        explanation=explanation
                    )
                )
                score -= 5.0

            elif prob < (thresh * 0.4) and tag in normalized_existing:
                suggestions.append(
                    TagSuggestion(
                        tag=tag,
                        category=category,
                        action=SuggestionAction.REVIEW,
                        confidence=round(prob, 3),
                        explanation=f"Tag '{tag}' exists in metadata, but model confidence is low ({prob:.0%})."
                    )
                )
                score -= 4.0

        score = max(0.0, min(100.0, score))

        adds = sum(1 for s in suggestions if s.action == SuggestionAction.ADD)
        reviews = sum(1 for s in suggestions if s.action == SuggestionAction.REVIEW)
        
        if score >= 85:
            summary = "Excellent metadata quality. Minor or no additions suggested."
        elif score >= 60:
            summary = f"Moderate metadata quality. {adds} tag(s) recommended to add, {reviews} tag(s) to review."
        else:
            summary = f"Weak metadata quality. Missing tags or core metadata. {adds} addition(s) suggested."

        return round(score, 1), suggestions, summary

    def _generate_explanation(self, tag: str, prob: float, audio: Dict[str, float]) -> str:
        bpm = audio.get("bpm", 120)
        energy = audio.get("energy", 0.5)
        
        if tag == "energetic":
            return f"High audio energy ({energy:.2f}) and tempo ({bpm:.0f} BPM) align with 'Energetic' (confidence: {prob:.0%})."
        elif tag in ["chill", "ambient"]:
            return f"Relaxed tempo ({bpm:.0f} BPM) aligns with '{tag}' (confidence: {prob:.0%})."
        return f"Model assigned {prob:.0%} confidence based on spectral audio analysis."