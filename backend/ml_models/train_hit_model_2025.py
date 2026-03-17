import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

current_dir = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# STEP 1: LOAD & MERGE DATASETS
# ============================================================
print("🚀 Step 1: Loading & Merging Datasets...")

# --- Dataset A: 2010s Kaggle Dataset (already has proper Spotify features) ---
df_10s = pd.read_csv(os.path.join(current_dir, 'dataset-of-10s.csv'))
print(f"   📀 2010s Dataset: {len(df_10s)} tracks")

# --- Dataset B: 2023 Spotify Dataset (needs normalization) ---
df_23 = pd.read_csv(os.path.join(current_dir, 'spotify-2023.csv'), encoding='latin-1')
print(f"   📀 2023 Dataset: {len(df_23)} tracks")

# --- Normalize 2023 to match 2010s format ---

# Key: Letter -> Number (C=0, C#=1, D=2, ... B=11)
key_map = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
}
df_23['key'] = df_23['key'].map(key_map).fillna(0).astype(int)

# Mode: Major/Minor -> 1/0
df_23['mode'] = df_23['mode'].apply(lambda x: 1 if x == 'Major' else 0)

# Percentage features -> 0.0 to 1.0 scale
df_23['danceability'] = df_23['danceability_%'] / 100.0
df_23['energy'] = df_23['energy_%'] / 100.0
df_23['acousticness'] = df_23['acousticness_%'] / 100.0
df_23['instrumentalness'] = df_23['instrumentalness_%'] / 100.0
df_23['liveness'] = df_23['liveness_%'] / 100.0
df_23['valence'] = df_23['valence_%'] / 100.0
df_23['speechiness'] = df_23['speechiness_%'] / 100.0

# Rename bpm -> tempo
df_23['tempo'] = df_23['bpm'].astype(float)

# Missing columns: Approximate with reasonable defaults
# Loudness: Estimate from energy (high energy ≈ louder)
df_23['loudness'] = -12.0 + (df_23['energy'] * 8.0)  # Maps 0→-12dB, 1→-4dB

# Duration: Not available, use median pop duration (3:20 = 200000ms)
df_23['duration_ms'] = 200000.0

# Time signature: Standard pop = 4
df_23['time_signature'] = 4.0

# Target: These are TOP STREAMED songs → they are HITS (target=1)
# We'll label them as hits. The 10s dataset already has mixed hits/flops.
df_23['target'] = 1

# Select only the columns we need
common_cols = [
    'danceability', 'energy', 'key', 'loudness', 'mode',
    'speechiness', 'acousticness', 'instrumentalness',
    'liveness', 'valence', 'tempo', 'duration_ms', 'time_signature', 'target'
]

df_23_clean = df_23[common_cols]
df_10s_clean = df_10s[common_cols]

# MERGE!
df = pd.concat([df_10s_clean, df_23_clean], ignore_index=True)
df = df.dropna()
print(f"   🔗 Mega Dataset: {len(df)} total tracks ({len(df_10s_clean)} from 10s + {len(df_23_clean)} from 2023)")
print(f"   📊 Hit/Flop ratio: {df['target'].value_counts().to_dict()}")

# ============================================================
# STEP 2: FEATURE ENGINEERING (2025 Industry Rules)
# ============================================================
print("\n🧬 Step 2: FEATURE ENGINEERING (Injecting 2025 Industry Rules)...")

# Rule 1: The Streaming Sweet Spot (2:30 to 3:30)
df['is_streaming_sweet_spot'] = df['duration_ms'].apply(
    lambda x: 1 if 150000 <= x <= 214000 else 0
)

# Rule 2: Optimal Modern Tempo (100 to 128 BPM)
df['is_optimal_tempo'] = df['tempo'].apply(
    lambda x: 1 if 100 <= x <= 128 else 0
)

# Rule 3: The "Pop Bean Shape" (High Danceability + High Energy)
df['pop_bean_shape_score'] = df['danceability'] * df['energy']

print("   ✅ Added: is_streaming_sweet_spot")
print("   ✅ Added: is_optimal_tempo")
print("   ✅ Added: pop_bean_shape_score")

# ============================================================
# STEP 3: TRAIN THE MODEL
# ============================================================
features = [
    'danceability', 'energy', 'key', 'loudness', 'mode',
    'speechiness', 'acousticness', 'instrumentalness',
    'liveness', 'valence', 'tempo', 'duration_ms', 'time_signature',
    'is_streaming_sweet_spot', 'is_optimal_tempo', 'pop_bean_shape_score'
]

X = df[features]
y = df['target']

print("\n🧮 Step 3: Preprocessing Data...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print("🧠 Step 4: Training the 2025-Aware XGBoost AI...")
model = XGBClassifier(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=6,
    random_state=42,
    eval_metric='logloss'
)
model.fit(X_train_scaled, y_train)

# ============================================================
# STEP 4: EVALUATE
# ============================================================
print("\n📊 Step 5: Evaluating the AI...")
y_pred = model.predict(X_test_scaled)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n======================================")
print(f"✅ MODEL ACCURACY: {accuracy * 100:.2f}%")
print(f"======================================\n")
print("Detailed Report:")
print(classification_report(y_test, y_pred))

# Feature importance
feature_importances = model.feature_importances_
importance_df = pd.DataFrame({'Feature': features, 'Importance': feature_importances})
importance_df = importance_df.sort_values(by='Importance', ascending=False)
print("\n🔥 Top 5 Most Important Features for a 2025 Hit:")
print(importance_df.head(5).to_string(index=False))

# ============================================================
# STEP 5: SAVE
# ============================================================
print("\n💾 Step 6: Saving the 2025 Brain to disk...")
joblib.dump(model, os.path.join(current_dir, 'hit_predictor_model_2025.pkl'))
joblib.dump(scaler, os.path.join(current_dir, 'feature_scaler_2025.pkl'))
print("🎉 Done! 'hit_predictor_model_2025.pkl' is ready for NextDrop.")
