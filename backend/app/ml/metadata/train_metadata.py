import os
import json
import time
import argparse
import numpy as np
import pandas as pd
import joblib
from typing import Dict, List, Tuple
from xgboost import XGBClassifier
from sklearn.multioutput import MultiOutputClassifier
from sklearn.metrics import f1_score


def precision_at_k(y_true: np.ndarray, y_pred_probs: np.ndarray, k: int = 5) -> float:
    """Computes Mean Precision@K for multi-label binary targets."""
    precisions = []
    for i in range(y_true.shape[0]):
        top_k_idx = np.argsort(y_pred_probs[i])[::-1][:k]
        true_labels = np.where(y_true[i] == 1)[0]
        if len(true_labels) == 0:
            continue
        hits = len(set(top_k_idx).intersection(set(true_labels)))
        precisions.append(hits / min(k, len(true_labels)))
    return float(np.mean(precisions)) if precisions else 0.0


def optimize_thresholds(y_true: np.ndarray, y_probs: np.ndarray, label_cols: List[str]) -> Dict[str, float]:
    """Finds F1-maximizing decision threshold per class."""
    threshold_dict = {}
    n_classes = y_true.shape[1]
    
    for c in range(n_classes):
        best_f1 = -1.0
        best_t = 0.5
        for t in np.arange(0.15, 0.85, 0.05):
            preds = (y_probs[:, c] >= t).astype(int)
            score = f1_score(y_true[:, c], preds, zero_division=0)
            if score > best_f1:
                best_f1 = score
                best_t = float(t)
        threshold_dict[label_cols[c]] = round(best_t, 3)
    return threshold_dict


def load_dataset(npz_path: str, csv_path: str) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    print(f"Loading features: {npz_path}")
    npz_data = np.load(npz_path)
    feat_ids = npz_data["track_ids"]
    X_raw = npz_data["features"]

    print(f"Loading labels: {csv_path}")
    labels_df = pd.read_csv(csv_path)
    label_cols = [c for c in labels_df.columns if c != "track_id"]
    labels_df = labels_df.set_index("track_id")
    
    valid_mask = [tid in labels_df.index for tid in feat_ids]
    feat_ids_clean = feat_ids[valid_mask]
    X_clean = X_raw[valid_mask]
    Y_clean = labels_df.loc[feat_ids_clean][label_cols].values

    return X_clean, Y_clean, label_cols


def run_training(
    train_npz: str,
    train_csv: str,
    val_npz: str,
    val_csv: str,
    output_dir: str
):
    os.makedirs(output_dir, exist_ok=True)

    X_train, Y_train, label_cols = load_dataset(train_npz, train_csv)
    X_val, Y_val, val_label_cols = load_dataset(val_npz, val_csv)

    print(f"\nDataset loaded:")
    print(f"  - Train tracks: {X_train.shape[0]} | Val tracks: {X_val.shape[0]}")
    print(f"  - Target tags : {len(label_cols)}")

    print(f"\nTraining {len(label_cols)} XGBoost binary models (with live logging)...")
    estimators = []
    start_total = time.time()

    for idx, label in enumerate(label_cols):
        t0 = time.time()
        print(f"  [{idx+1:02d}/{len(label_cols):02d}] Training tag model: '{label}'...", end="", flush=True)

        clf_tag = XGBClassifier(
            n_estimators=80,
            max_depth=5,
            learning_rate=0.1,
            tree_method="hist",
            n_jobs=-1,
            random_state=42
        )
        clf_tag.fit(X_train, Y_train[:, idx])
        estimators.append(clf_tag)

        dt = time.time() - t0
        print(f" Done ({dt:.1f}s)")

    # Wrap into sklearn MultiOutputClassifier container
    base_dummy = XGBClassifier()
    clf = MultiOutputClassifier(base_dummy)
    clf.estimators_ = estimators

    total_time = time.time() - start_total
    print(f"\n All models trained in {total_time:.1f}s!")

    print("\nEvaluating on validation set & tuning optimal decision thresholds...")
    prob_list = clf.predict_proba(X_val)
    
    Y_val_probs = np.column_stack([
        p[:, 1] if p.shape[1] == 2 else np.zeros(len(X_val)) for p in prob_list
    ])

    threshold_dict = optimize_thresholds(Y_val, Y_val_probs, label_cols)

    Y_val_pred_binary = np.zeros_like(Y_val_probs)
    for c, label in enumerate(label_cols):
        th = threshold_dict[label]
        Y_val_pred_binary[:, c] = (Y_val_probs[:, c] >= th).astype(int)

    micro_f1 = f1_score(Y_val, Y_val_pred_binary, average="micro", zero_division=0)
    macro_f1 = f1_score(Y_val, Y_val_pred_binary, average="macro", zero_division=0)
    p_at_5 = precision_at_k(Y_val, Y_val_probs, k=5)

    print("\n=================== VALIDATION BENCHMARK RESULTS ===================")
    print(f" Micro F1 Score     : {micro_f1:.4f}")
    print(f" Macro F1 Score     : {macro_f1:.4f}")
    print(f" Precision@5        : {p_at_5:.4f}")
    print("====================================================================")

    model_path = os.path.join(output_dir, "metadata_model.joblib")
    manifest_path = os.path.join(output_dir, "manifest.json")

    joblib.dump(clf, model_path)

    manifest = {
        "labels": label_cols,
        "thresholds": threshold_dict,
        "metrics": {
            "micro_f1": round(float(micro_f1), 4),
            "macro_f1": round(float(macro_f1), 4),
            "precision_at_5": round(float(p_at_5), 4)
        },
        "num_train_samples": len(X_train),
        "num_val_samples": len(X_val)
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n Model artifacts saved to '{output_dir}':")
    print(f"  - Model binary : {model_path}")
    print(f"  - Manifest JSON: {manifest_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train NextDrop Multi-Label Metadata Model")
    parser.add_argument("--train-npz", default="data/processed/train_features.npz")
    parser.add_argument("--train-csv", default="data/processed/train_labels.csv")
    parser.add_argument("--val-npz", default="data/processed/val_features.npz")
    parser.add_argument("--val-csv", default="data/processed/val_labels.csv")
    parser.add_argument("--out-dir", default="models/metadata")

    args = parser.parse_args()
    run_training(args.train_npz, args.train_csv, args.val_npz, args.val_csv, args.out_dir)