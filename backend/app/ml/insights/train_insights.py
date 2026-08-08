import os
import json
import numpy as np
import pandas as pd
import joblib
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report

from .schemas import InsightType, InsightCategory


FEATURE_NAMES = [
    "current_streams", "sma_2w", "sma_4w", "sma_ratio",
    "wow_stream_growth", "mow_stream_growth", "wow_save_growth",
    "wow_ugc_growth", "save_rate_current", "save_rate_change",
    "ugc_per_1k_streams", "playlist_add_conversion",
    "stream_slope_normalized", "top_platform_share"
]


def generate_synthetic_training_data(n_samples: int = 2000):
    """Generates synthetic time-series summary dataset covering all SMA & growth features."""
    np.random.seed(42)
    rows = []

    for _ in range(n_samples):
        streams = np.random.uniform(1000, 500000)
        
        # Calculate synthetic Simple Moving Averages (SMA)
        sma_2w = float(streams * np.random.uniform(0.85, 1.25))
        sma_4w = float(streams * np.random.uniform(0.75, 1.15))
        sma_ratio = float(sma_2w / max(1.0, sma_4w))

        wow_growth = float(np.random.uniform(-0.5, 1.5))
        mow_growth = float(np.random.uniform(-0.3, 2.0))
        wow_save = float(np.random.uniform(-0.4, 1.0))
        wow_ugc = float(np.random.uniform(-0.2, 3.0))
        save_rate = float(np.random.uniform(0.005, 0.12))
        save_rate_change = float(np.random.uniform(-0.02, 0.05))
        ugc_1k = float(np.random.uniform(0.1, 50.0))
        playlist_conv = float(np.random.uniform(0.01, 0.4))
        slope = float(np.random.uniform(-0.5, 0.8))
        top_share = float(np.random.uniform(0.3, 0.95))

        # Ground truth rule simulation covering all InsightType enum targets
        if wow_growth > 0.60 and wow_ugc > 0.80:
            label_str = InsightType.VIRAL_UGC_DRIVEN.value
        elif sma_ratio > 1.25 and wow_growth > 0.30:
            label_str = InsightType.BREAKOUT_MOMENTUM.value
        elif wow_growth < -0.20 and slope < -0.1:
            label_str = InsightType.DECLINING_TRAJECTORY.value
        elif save_rate > 0.06:
            label_str = InsightType.HIGH_RETENTION_PASSION.value
        elif playlist_conv > 0.25:
            label_str = InsightType.PLAYLIST_DEPENDENT.value
        elif top_share > 0.80:
            label_str = InsightType.PLATFORM_CONCENTRATED.value
        elif save_rate < 0.015 and wow_growth > 0.2:
            label_str = InsightType.LOW_SAVING_CONVERSION.value
        elif playlist_conv < 0.05 and wow_growth > 0.3:
            label_str = InsightType.UNTAPPED_CURATION_POTENTIAL.value
        else:
            label_str = InsightType.STEADY_GROWTH.value

        row = [
            streams, sma_2w, sma_4w, sma_ratio,
            wow_growth, mow_growth, wow_save, wow_ugc,
            save_rate, save_rate_change, ugc_1k, playlist_conv,
            slope, top_share, label_str
        ]
        rows.append(row)

    cols = FEATURE_NAMES + ["label"]
    return pd.DataFrame(rows, columns=cols)


def run_training(output_dir: str = "models/insights"):
    os.makedirs(output_dir, exist_ok=True)
    
    print("Generating training time-series dataset...")
    df = generate_synthetic_training_data(n_samples=2500)
    
    X = df[FEATURE_NAMES].values
    y_raw = df["label"].values

    le = LabelEncoder()
    Y = le.fit_transform(y_raw)

    split_idx = int(len(X) * 0.8)
    X_train, X_val = X[:split_idx], X[split_idx:]
    Y_train, Y_val = Y[:split_idx], Y[split_idx:]

    print(f"Training XGBoost Insights Classifier on {len(X_train)} samples across {len(le.classes_)} classes...")
    clf = XGBClassifier(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.08,
        eval_metric="mlogloss",
        random_state=42
    )
    clf.fit(X_train, Y_train)

    preds = clf.predict(X_val)
    print("\n--- Validation Report ---")
    print(classification_report(Y_val, preds, target_names=le.classes_, zero_division=0))

    # Save model and manifest artifacts
    model_path = os.path.join(output_dir, "insights_model.joblib")
    manifest_path = os.path.join(output_dir, "manifest.json")

    joblib.dump(clf, model_path)

    category_mapping = {
        InsightType.BREAKOUT_MOMENTUM.value: InsightCategory.GROWTH_TRAJECTORY.value,
        InsightType.STEADY_GROWTH.value: InsightCategory.GROWTH_TRAJECTORY.value,
        InsightType.DECLINING_TRAJECTORY.value: InsightCategory.GROWTH_TRAJECTORY.value,
        InsightType.VIRAL_UGC_DRIVEN.value: InsightCategory.PLATFORM_DYNAMICS.value,
        InsightType.PLATFORM_CONCENTRATED.value: InsightCategory.PLATFORM_DYNAMICS.value,
        InsightType.HIGH_RETENTION_PASSION.value: InsightCategory.ENGAGEMENT_QUALITY.value,
        InsightType.LOW_SAVING_CONVERSION.value: InsightCategory.ENGAGEMENT_QUALITY.value,
        InsightType.PLAYLIST_DEPENDENT.value: InsightCategory.CURATION_IMPACT.value,
        InsightType.UNTAPPED_CURATION_POTENTIAL.value: InsightCategory.CURATION_IMPACT.value,
    }

    manifest = {
        "feature_names": FEATURE_NAMES,
        "classes": le.classes_.tolist(),
        "insight_categories": category_mapping
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nModel artifacts saved to '{output_dir}'")


if __name__ == "__main__":
    run_training()