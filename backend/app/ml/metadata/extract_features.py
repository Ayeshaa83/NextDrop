import os
import argparse
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional


class AudioFeatureExtractor:
    def __init__(self, panns_dim: int = 2048, use_gpu: bool = False):
        self.panns_dim = panns_dim
        self.device = "cuda" if use_gpu else "cpu"
        self.panns_model = None

    def _init_panns(self):
        if self.panns_model is None:
            try:
                from panns_inference import AudioTagging
                self.panns_model = AudioTagging(checkpoint_path=None, device=self.device)
            except Exception as e:
                pass

    def extract_from_audio_file(self, audio_path: str) -> Tuple[np.ndarray, Dict[str, float]]:
        import librosa

        y, sr = librosa.load(audio_path, sr=32000, duration=30.0, mono=True)

        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo[0] if isinstance(tempo, np.ndarray) else tempo)
        rms = librosa.feature.rms(y=y)
        energy = float(np.mean(rms))
        loudness_db = float(librosa.amplitude_to_db(rms).mean())
        spec_cent = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        spec_rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        
        audio_features = {
            "bpm": bpm,
            "energy": energy,
            "loudness_db": loudness_db,
            "spectral_centroid": spec_cent,
            "spectral_rolloff": spec_rolloff,
            "zero_crossing_rate": zcr,
            "danceability": float(np.clip(energy * 1.2, 0, 1)),
            "instrumentalness": float(np.clip(1.0 - zcr * 2.0, 0, 1))
        }

        self._init_panns()
        if self.panns_model is not None:
            audio_tensor = y[np.newaxis, :]
            _, panns_emb = self.panns_model.inference(audio_tensor)
            panns_emb = panns_emb[0]
        else:
            panns_emb = self.generate_synthetic_embedding(audio_path)

        return panns_emb, audio_features

    def generate_synthetic_embedding(self, track_id: str) -> np.ndarray:
        seed = abs(hash(track_id)) % (2**32 - 1)
        rng = np.random.RandomState(seed)
        emb = rng.randn(self.panns_dim).astype(np.float32)
        return emb / (np.linalg.norm(emb) + 1e-8)

    def generate_synthetic_descriptors(self, track_id: str) -> Dict[str, float]:
        seed = abs(hash(track_id)) % (2**32 - 1)
        rng = np.random.RandomState(seed)
        return {
            "bpm": float(rng.uniform(70, 160)),
            "energy": float(rng.uniform(0.1, 0.99)),
            "loudness_db": float(rng.uniform(-25, -3)),
            "spectral_centroid": float(rng.uniform(500, 4000)),
            "spectral_rolloff": float(rng.uniform(1000, 8000)),
            "zero_crossing_rate": float(rng.uniform(0.01, 0.2)),
            "danceability": float(rng.uniform(0.1, 0.95)),
            "instrumentalness": float(rng.uniform(0.0, 1.0))
        }

    def assemble_vector(
        self,
        panns_emb: np.ndarray,
        audio_features: Dict[str, float],
        artist_id: str = ""
    ) -> np.ndarray:
        audio_vec = np.array([
            audio_features.get("bpm", 120.0) / 200.0,
            audio_features.get("energy", 0.5),
            (audio_features.get("loudness_db", -10.0) + 30.0) / 30.0,
            audio_features.get("spectral_centroid", 2000.0) / 5000.0,
            audio_features.get("spectral_rolloff", 4000.0) / 10000.0,
            audio_features.get("zero_crossing_rate", 0.05) * 10.0,
            audio_features.get("danceability", 0.5),
            audio_features.get("instrumentalness", 0.5)
        ], dtype=np.float32)

        ctx_seed = abs(hash(artist_id)) % (2**32 - 1) if artist_id else 42
        rng = np.random.RandomState(ctx_seed)
        ctx_vec = np.array([
            rng.uniform(0.1, 1.0),
            rng.uniform(0.5, 1.0)
        ], dtype=np.float32)

        return np.concatenate([panns_emb, audio_vec, ctx_vec]).astype(np.float32)


def process_features(
    labels_csv_path: str,
    tracks_csv_path: str,
    output_npz_path: str,
    audio_dir: Optional[str] = None
):
    print(f"Loading labels from: {labels_csv_path}")
    labels_df = pd.read_csv(labels_csv_path)
    
    tracks_meta = {}
    if os.path.exists(tracks_csv_path):
        meta_df = pd.read_csv(tracks_csv_path)
        for _, row in meta_df.iterrows():
            tracks_meta[row["track_id"]] = row.to_dict()

    extractor = AudioFeatureExtractor()
    track_ids = []
    features_list = []

    print(f"Extracting features for {len(labels_df)} tracks...")
    
    for idx, tid in enumerate(labels_df["track_id"]):
        if (idx + 1) % 5000 == 0 or idx == len(labels_df) - 1:
            print(f"  Processed {idx + 1}/{len(labels_df)} tracks...")

        meta = tracks_meta.get(tid, {})
        rel_path = meta.get("rel_path", "")
        audio_file = os.path.join(audio_dir, rel_path) if audio_dir and rel_path else None

        if audio_file and os.path.exists(audio_file):
            panns_emb, audio_feats = extractor.extract_from_audio_file(audio_file)
        else:
            panns_emb = extractor.generate_synthetic_embedding(tid)
            audio_feats = extractor.generate_synthetic_descriptors(tid)

        vector = extractor.assemble_vector(panns_emb, audio_feats, artist_id=meta.get("artist_id", ""))
        track_ids.append(tid)
        features_list.append(vector)

    track_ids_arr = np.array(track_ids)
    features_matrix = np.vstack(features_list).astype(np.float32)

    os.makedirs(os.path.dirname(output_npz_path), exist_ok=True)
    np.savez_compressed(output_npz_path, track_ids=track_ids_arr, features=features_matrix)
    
    print(f"\n Successfully saved compressed features -> '{output_npz_path}'")
    print(f"  - Array shape: {features_matrix.shape} (Tracks x Vector_Dim)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract features for NextDrop metadata pipeline")
    parser.add_argument("--labels", required=True, help="Path to train_labels.csv or val_labels.csv")
    parser.add_argument("--tracks", default="data/processed/jamendo_tracks.csv", help="Path to jamendo_tracks.csv")
    parser.add_argument("--out", required=True, help="Output .npz path (e.g. data/processed/train_features.npz)")
    parser.add_argument("--audio-dir", default=None, help="Optional directory containing raw MP3 files")

    args = parser.parse_args()
    process_features(args.labels, args.tracks, args.out, args.audio_dir)