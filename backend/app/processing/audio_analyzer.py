"""
Audio analysis module using Librosa + XGBoost ML Model for AI-powered track analysis.

This module provides:
- BPM detection (with half-time correction)
- Key/Scale detection
- Genre classification (heuristic-based)
- Hit score prediction (XGBoost 2025 model with 16 features)
- Audio feature extraction calibrated to Spotify's scale

Note: Librosa operations are CPU-intensive and should always be run
in background tasks, never in synchronous API routes.
"""
import logging
import os
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict, field
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Thread pool for CPU-bound audio processing
_executor = ThreadPoolExecutor(max_workers=2)

# ML Model paths (relative to ml_models directory)
_ML_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'ml_models')
_model = None
_scaler = None


def _load_ml_model():
    """Lazy-load the trained XGBoost model and scaler."""
    global _model, _scaler
    if _model is not None:
        return
    
    try:
        import joblib
        
        # Try 2025 model first, fall back to original
        model_path = os.path.join(_ML_MODELS_DIR, 'hit_predictor_model_2025.pkl')
        scaler_path = os.path.join(_ML_MODELS_DIR, 'feature_scaler_2025.pkl')
        
        if not os.path.exists(model_path):
            model_path = os.path.join(_ML_MODELS_DIR, 'hit_predictor_model.pkl')
            scaler_path = os.path.join(_ML_MODELS_DIR, 'feature_scaler.pkl')
        
        if os.path.exists(model_path):
            _model = joblib.load(model_path)
            _scaler = joblib.load(scaler_path)
            logger.info(f"ML model loaded from {model_path}")
        else:
            logger.warning(f"No ML model found at {model_path}. Hit scores will use heuristics.")
    except Exception as e:
        logger.error(f"Failed to load ML model: {e}")


@dataclass
class AudioFeatures:
    """Container for extracted audio features."""
    bpm: Optional[float] = None
    key: Optional[str] = None  # e.g., "C major", "A minor"
    energy: Optional[float] = None  # 0.0 - 1.0
    danceability: Optional[float] = None  # 0.0 - 1.0
    valence: Optional[float] = None  # 0.0 - 1.0 (musical positivity)
    acousticness: Optional[float] = None  # 0.0 - 1.0
    instrumentalness: Optional[float] = None  # 0.0 - 1.0
    loudness_db: Optional[float] = None
    speechiness: Optional[float] = None  # 0.0 - 1.0
    liveness: Optional[float] = None  # 0.0 - 1.0
    duration_ms: Optional[float] = None
    time_signature: Optional[float] = None
    # 2025 Engineered Features
    is_streaming_sweet_spot: Optional[float] = None  # 1 if 2:30-3:30
    is_optimal_tempo: Optional[float] = None  # 1 if 100-128 BPM
    pop_bean_shape_score: Optional[float] = None  # danceability * energy
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AIAnalysisResult:
    """Complete AI analysis result for a track."""
    features: AudioFeatures
    predicted_genre: Optional[str] = None
    genre_confidence: Optional[float] = None
    hit_score: Optional[float] = None  # 0 - 100 hit prediction
    hit_factors: Optional[Dict[str, float]] = None  # Contributing factors
    similar_tracks: Optional[list] = None
    recommendations: Optional[list] = None
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        # Ensure all numeric values are standard Python types for JSON serialization
        return self._sanitize_dict(data)

    def _sanitize_dict(self, d: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively convert numpy types to standard Python types."""
        import numpy as np
        new_dict = {}
        for k, v in d.items():
            if isinstance(v, dict):
                new_dict[k] = self._sanitize_dict(v)
            elif isinstance(v, (np.float32, np.float64)):
                new_dict[k] = float(v)
            elif isinstance(v, (np.int32, np.int64)):
                new_dict[k] = int(v)
            elif isinstance(v, list):
                new_dict[k] = [float(i) if isinstance(i, (np.float32, np.float64)) else i for i in v]
            else:
                new_dict[k] = v
        return new_dict


class AudioAnalyzer:
    """
    Audio analyzer using Librosa + XGBoost for feature extraction and AI analysis.
    
    Usage:
        analyzer = AudioAnalyzer()
        result = await analyzer.analyze(audio_file_path)
    """
    
    def __init__(self):
        self._librosa = None
        self._numpy = None
        self._scipy = None
        
    def _ensure_librosa(self):
        """Lazy load librosa to avoid startup overhead."""
        if self._librosa is None:
            try:
                import librosa
                import numpy as np
                import scipy
                self._librosa = librosa
                self._numpy = np
                self._scipy = scipy
                logger.info("Librosa loaded successfully")
            except ImportError as e:
                logger.warning(f"Librosa not installed: {e}. Install with: pip install librosa")
                raise ImportError(
                    "librosa is required for audio analysis. "
                    "Install with: pip install librosa numpy scipy"
                )
    
    def _extract_features_sync(self, file_path: str) -> AudioFeatures:
        """
        Calibrated feature extraction mimicking Spotify's scale.
        Uses the same multipliers from analyze_audio.py.
        """
        self._ensure_librosa()
        librosa = self._librosa
        np = self._numpy
        
        import warnings
        warnings.filterwarnings('ignore')
        
        logger.info(f"Loading audio file: {file_path}")
        
        # Load audio file (Full duration)
        y, sr = librosa.load(file_path, sr=22050, mono=True)
        
        # 0. Trim Silence (High Stability fix)
        # top_db=20 ensures we only analyze the actual music
        y_trimmed, _ = librosa.effects.trim(y, top_db=20)
        
        # Guard: If everything was silence or trimmed result is too short (< 100ms), 
        # use original to avoid empty array errors
        if len(y_trimmed) > sr * 0.1:
            y = y_trimmed
            logger.info(f"Audio trimmed successfully. New length: {len(y)}")
        else:
            logger.warning("Trimming resulted in empty or too short audio. Using original.")
        
        # 1. Duration
        duration_ms = librosa.get_duration(y=y, sr=sr) * 1000
        
        # 2. Tempo (Full-track histogram analysis)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo[0] if isinstance(tempo, np.ndarray) else tempo)
        if bpm < 90:
            bpm *= 2.0
        
        # 3. Loudness & Energy (Full-Song Calibration)
        # Multipliers calibrated to match Spotify's distribution (0.5 - 0.9 for hits)
        rms = librosa.feature.rms(y=y)
        energy = float(np.clip(np.mean(rms) * 4.0, 0.0, 1.0))
        # Spotify Loudness is usually negative (-12 to -4 dB for pop)
        loudness_db = float(np.clip(np.mean(librosa.amplitude_to_db(rms)) + 7.0, -60.0, 0.0))
        
        # 4. Key & Mode (Global Pitch Profile)
        chroma_stft = librosa.feature.chroma_stft(y=y, sr=sr)
        # Summing across time (axis=1) to get the overall pitch distribution
        key_idx = int(np.argmax(np.sum(chroma_stft, axis=1)))
        
        chroma_cqt = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_str = self._detect_key(chroma_cqt, np)
        
        # 5. Danceability (Full-Song Calibration)
        # Divider calibrated to avoid pinning hits at 1.0
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        danceability = float(np.clip(np.var(onset_env) / 3.0, 0.0, 1.0))
        
        # 6. Acousticness (Global Mean for scalar results)
        cent = librosa.feature.spectral_centroid(y=y, sr=sr)
        acousticness = float(np.clip(1.0 - (np.mean(cent) / 2500), 0.0, 1.0))
        
        # 7. Instrumentalness
        instrumentalness = 0.8 if energy < 0.3 and acousticness > 0.6 else 0.05
        
        # Defaults
        speechiness = 0.05
        liveness = 0.15
        valence = energy * 0.8
        time_signature = 4.0
        
        # 2025 Engineered Features
        is_streaming_sweet_spot = 1.0 if 150000 <= duration_ms <= 214000 else 0.0
        is_optimal_tempo = 1.0 if 100 <= bpm <= 128 else 0.0
        pop_bean_shape_score = danceability * energy
        
        return AudioFeatures(
            bpm=round(bpm, 1),
            key=key_str,
            energy=round(energy, 3),
            danceability=round(danceability, 3),
            valence=round(valence, 3),
            acousticness=round(acousticness, 3),
            instrumentalness=round(instrumentalness, 3),
            loudness_db=round(loudness_db, 2),
            speechiness=round(speechiness, 3),
            liveness=round(liveness, 3),
            duration_ms=round(duration_ms, 1),
            time_signature=time_signature,
            is_streaming_sweet_spot=is_streaming_sweet_spot,
            is_optimal_tempo=is_optimal_tempo,
            pop_bean_shape_score=round(pop_bean_shape_score, 3),
        )
    
    def _detect_key(self, chroma, np) -> str:
        """Detect musical key from chroma features."""
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        
        # Average chroma across time
        chroma_avg = np.mean(chroma, axis=1)
        
        # Find dominant pitch class
        key_idx = int(np.argmax(chroma_avg))
        
        # Simple major/minor detection
        major_profile = np.array([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1])
        minor_profile = np.array([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0])
        
        major_rotated = np.roll(major_profile, key_idx)
        minor_rotated = np.roll(minor_profile, key_idx)
        
        major_corr = np.corrcoef(chroma_avg, major_rotated)[0, 1]
        minor_corr = np.corrcoef(chroma_avg, minor_rotated)[0, 1]
        
        mode = "major" if major_corr > minor_corr else "minor"
        
        return f"{keys[key_idx]} {mode}"
    
    def _predict_genre_sync(self, file_path: str, features: AudioFeatures) -> tuple:
        """
        Predict genre using heuristics based on features.
        Returns (genre, confidence).
        """
        genre = "Electronic"
        confidence = 0.7
        
        if features.bpm:
            if features.bpm < 90:
                genre = "Hip Hop" if features.energy and features.energy > 0.5 else "R&B"
            elif features.bpm < 110:
                genre = "Pop"
            elif features.bpm < 135:
                # Distinguish between House and Dance-Pop
                # Abhi Toh Party Shuru Hui Hai is very vocal-heavy (low instrumentalness)
                if (features.instrumentalness or 0) < 0.1 and (features.speechiness or 0.05) > 0.03:
                    genre = "Dance Pop" if features.energy and features.energy > 0.6 else "Pop"
                else:
                    genre = "House" if features.danceability and features.danceability > 0.5 else "Electronic"
            elif features.bpm < 155:
                genre = "Techno" if (features.instrumentalness or 0) > 0.2 else "Electro Pop"
            else:
                genre = "Drum & Bass" if features.bpm > 160 else "Trance"
        
        if features.acousticness and features.acousticness > 0.7:
            genre = "Acoustic" if features.instrumentalness and features.instrumentalness > 0.5 else "Singer-Songwriter"
        
        return genre, confidence
    
    def _calculate_hit_score_sync(self, features: AudioFeatures) -> tuple:
        """
        Calculate hit potential using the trained XGBoost 2025 model.
        Falls back to heuristics if model is not available.
        Returns (score 0-100, contributing factors dict).
        """
        np = self._numpy
        _load_ml_model()
        
        if _model is not None and _scaler is not None:
            # === REAL ML MODEL PREDICTION ===
            # Build 16-feature array matching training order
            feature_array = np.array([[
                features.danceability or 0,
                features.energy or 0,
                # Key as number (extract from key string)
                self._key_str_to_num(features.key),
                features.loudness_db or -10,
                1 if features.key and "major" in features.key.lower() else 0,  # mode
                features.speechiness or 0.05,
                features.acousticness or 0,
                features.instrumentalness or 0,
                features.liveness or 0.15,
                features.valence or 0.5,
                features.bpm or 120,
                features.duration_ms or 200000,
                features.time_signature or 4,
                features.is_streaming_sweet_spot or 0,
                features.is_optimal_tempo or 0,
                features.pop_bean_shape_score or 0,
            ]])
            
            # Scale and predict
            features_scaled = _scaler.transform(feature_array)
            probability = _model.predict_proba(features_scaled)[0][1]
            score = round(probability * 100, 1)
            
            # Build factors from the features
            factors = {
                "danceability_boost": round((features.danceability or 0) * 15, 2),
                "energy_impact": round(((features.energy or 0) - 0.5) * 20, 2),
                "streaming_sweet_spot": "In zone (2:30-3:30)" if features.is_streaming_sweet_spot else "Outside zone",
                "optimal_tempo": "In zone (100-128 BPM)" if features.is_optimal_tempo else "Outside zone",
                "pop_bean_score": round(features.pop_bean_shape_score or 0, 3),
                "model_version": "XGBoost 2025 (16 features)",
            }
            
            logger.info(f"ML model hit score: {score}%")
            return score, factors
        
        else:
            # === FALLBACK HEURISTIC SCORING ===
            logger.warning("ML model not available, using heuristic scoring")
            factors = {}
            score = 50.0
            
            if features.bpm:
                if 100 <= features.bpm <= 130:
                    bpm_bonus = 10
                elif 85 <= features.bpm <= 145:
                    bpm_bonus = 5
                else:
                    bpm_bonus = -5
                factors["bpm_appeal"] = bpm_bonus
                score += bpm_bonus
            
            if features.energy:
                energy_bonus = (features.energy - 0.5) * 20
                factors["energy_impact"] = round(energy_bonus, 2)
                score += energy_bonus
            
            if features.danceability:
                dance_bonus = features.danceability * 15
                factors["danceability_boost"] = round(dance_bonus, 2)
                score += dance_bonus
            
            if features.valence:
                valence_bonus = features.valence * 10
                factors["mood_factor"] = round(valence_bonus, 2)
                score += valence_bonus
            
            factors["model_version"] = "Heuristic fallback (no ML model)"
            score = max(0, min(100, score))
            
            return round(score, 1), factors
    
    def _key_str_to_num(self, key_str: Optional[str]) -> int:
        """Convert key string like 'C major' to number 0-11."""
        if not key_str:
            return 0
        key_map = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        }
        key_name = key_str.split()[0] if key_str else 'C'
        return key_map.get(key_name, 0)
    
    async def analyze(self, file_path: str) -> AIAnalysisResult:
        """
        Perform full AI analysis on an audio file.
        This runs CPU-bound operations in a thread pool.
        """
        loop = asyncio.get_event_loop()
        
        # Extract features in thread pool
        features = await loop.run_in_executor(
            _executor,
            self._extract_features_sync,
            file_path
        )
        
        # Predict genre
        genre, confidence = await loop.run_in_executor(
            _executor,
            self._predict_genre_sync,
            file_path,
            features
        )
        
        # Calculate hit score (ML model or fallback)
        hit_score, hit_factors = await loop.run_in_executor(
            _executor,
            self._calculate_hit_score_sync,
            features
        )
        
        return AIAnalysisResult(
            features=features,
            predicted_genre=genre,
            genre_confidence=confidence,
            hit_score=hit_score,
            hit_factors=hit_factors,
            similar_tracks=[],
            recommendations=[],
        )
    
    def analyze_sync(self, file_path: str) -> AIAnalysisResult:
        """
        Synchronous version for use in background tasks.
        """
        features = self._extract_features_sync(file_path)
        genre, confidence = self._predict_genre_sync(file_path, features)
        hit_score, hit_factors = self._calculate_hit_score_sync(features)
        
        return AIAnalysisResult(
            features=features,
            predicted_genre=genre,
            genre_confidence=confidence,
            hit_score=hit_score,
            hit_factors=hit_factors,
            similar_tracks=[],
            recommendations=[],
        )


# Convenience function for background task usage
def analyze_track_background(file_path: str) -> Dict[str, Any]:
    """
    Analyze a track and return results as a dictionary.
    Designed for use with FastAPI BackgroundTasks.
    """
    analyzer = AudioAnalyzer()
    result = analyzer.analyze_sync(file_path)
    return result.to_dict()
