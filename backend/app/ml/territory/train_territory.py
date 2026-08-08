import os
import json
import numpy as np
import pandas as pd
import joblib
from xgboost import XGBRegressor

FEATURE_NAMES = [
    "current_streams", "wow_growth", "save_rate", 
    "reels_velocity", "engagement_per_stream", 
    "normalized_slope", "genre_affinity"
]


def generate_synthetic_india_territory_dataset(n_samples: int = 1500):
    np.random.seed(42)
    rows = []

    for _ in range(n_samples):
        streams = np.random.uniform(100, 100000)
        growth = np.random.uniform(-0.3, 2.0)
        save_rate = np.random.uniform(0.005, 0.12)
        reels_vel = np.random.uniform(-0.2, 3.0)
        eng_per_stream = np.random.uniform(0.01, 0.25)
        slope = np.random.uniform(-0.4, 0.8)
        affinity = np.random.uniform(0.6, 0.98)

        opportunity_target = (
            (growth * 25.0) + 
            (reels_vel * 22.0) + 
            (save_rate * 250.0) + 
            (affinity * 20.0) + 
            (slope * 15.0)
        )
        opportunity_target = np.clip(opportunity_target, 0.0, 100.0)

        rows.append([
            streams, growth, save_rate, reels_vel, 
            eng_per_stream, slope, affinity, opportunity_target
        ])

    cols = FEATURE_NAMES + ["target_opportunity"]
    return pd.DataFrame(rows, columns=cols)


def run_training(output_dir: str = "models/territory"):
    os.makedirs(output_dir, exist_ok=True)

    print("Generating synthetic India regional dataset...")
    df = generate_synthetic_india_territory_dataset()

    X = df[FEATURE_NAMES].values
    Y = df["target_opportunity"].values

    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    Y_train, Y_val = Y[:split], Y[split:]

    print(f"Training XGBoost India Regional Opportunity Regressor on {len(X_train)} samples...")
    model = XGBRegressor(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.08,
        random_state=42
    )
    model.fit(X_train, Y_train)

    val_preds = model.predict(X_val)
    mae = np.mean(np.abs(val_preds - Y_val))
    print(f"Validation MAE: {mae:.2f} Score Points")

    model_path = os.path.join(output_dir, "territory_model.joblib")
    manifest_path = os.path.join(output_dir, "manifest.json")

    joblib.dump(model, model_path)
    
    manifest = {
        "feature_names": FEATURE_NAMES,
        "mae": round(float(mae), 2)
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f" India Territory model artifacts saved to '{output_dir}'")


if __name__ == "__main__":
    run_training()