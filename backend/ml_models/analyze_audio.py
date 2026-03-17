import librosa
import numpy as np
import joblib
import warnings
import os

warnings.filterwarnings('ignore') # Hides annoying librosa warnings

print("🤖 Loading AI Brain (2025 Edition)...")
# Load the 2025 model and scaler
current_dir = os.path.dirname(os.path.abspath(__file__))

# Try loading 2025 model first, fall back to original
model_path = os.path.join(current_dir, 'hit_predictor_model_2025.pkl')
scaler_path = os.path.join(current_dir, 'feature_scaler_2025.pkl')

if not os.path.exists(model_path):
    print("⚠️  2025 model not found, falling back to original model...")
    model_path = os.path.join(current_dir, 'hit_predictor_model.pkl')
    scaler_path = os.path.join(current_dir, 'feature_scaler.pkl')
    USE_2025 = False
else:
    USE_2025 = True

try:
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    print(f"   Loaded: {'2025 Edition (16 features)' if USE_2025 else 'Original (13 features)'}")
except Exception as e:
    print(f"❌ Error loading models: {e}. Please train the model first to generate .pkl files.")
    model = None
    scaler = None


def extract_features(audio_path):
    print(f"🎧 Listening to: {audio_path}...")
    
    # Load audio file
    y, sr = librosa.load(audio_path, sr=22050)
    
    # 1. Duration
    duration_ms = librosa.get_duration(y=y, sr=sr) * 1000
    
    # 2. Tempo (Fixing the Half-Time bug)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(tempo[0] if isinstance(tempo, np.ndarray) else tempo)
    if tempo < 90:  # If it detects half-time for a pop song, double it!
        tempo *= 2.0
    
    # 3. Loudness (Spotify LUFS vs Librosa RMS)
    rms = librosa.feature.rms(y=y)
    energy = np.clip(np.mean(rms) * 5.0, 0.0, 1.0) 
    # Librosa raw dB is usually -25dB. We boost it by +20 to match Spotify's -5dB target.
    loudness = np.clip(np.mean(librosa.amplitude_to_db(rms)) + 20.0, -60.0, 0.0)
    
    # 4. Key & Mode
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    key = np.argmax(np.sum(chroma, axis=1)) 
    mode = 1 if key in [0, 2, 4, 5, 7, 9, 11] else 0 
    
    # 5. Danceability (Fixing the variance)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    # Spotify measures how punchy the drums are. We use variance instead of mean.
    danceability = np.clip(np.var(onset_env) / 2.0, 0.0, 1.0)
    
    # 6. Acousticness
    cent = librosa.feature.spectral_centroid(y=y, sr=sr)
    acousticness = np.clip(1.0 - (np.mean(cent) / 2500), 0.0, 1.0)
    
    # 7. Instrumentalness
    instrumentalness = 0.8 if energy < 0.3 and acousticness > 0.6 else 0.05
    
    # Defaults/Approximations
    speechiness = 0.05
    liveness = 0.15
    valence = energy * 0.8
    time_signature = 4.0
    
    # === 2025 FEATURE ENGINEERING ===
    # Rule 1: Streaming Sweet Spot (2:30 to 3:30)
    is_streaming_sweet_spot = 1.0 if 150000 <= duration_ms <= 214000 else 0.0
    
    # Rule 2: Optimal Modern Tempo (100 to 128 BPM)
    is_optimal_tempo = 1.0 if 100 <= tempo <= 128 else 0.0
    
    # Rule 3: Pop Bean Shape Score
    pop_bean_shape_score = danceability * energy

    features_dict = {
        'danceability': danceability,
        'energy': energy,
        'key': key,
        'loudness': loudness,
        'mode': mode,
        'speechiness': speechiness,
        'acousticness': acousticness,
        'instrumentalness': instrumentalness,
        'liveness': liveness,
        'valence': valence,
        'tempo': tempo,
        'duration_ms': duration_ms,
        'time_signature': time_signature,
        'is_streaming_sweet_spot': is_streaming_sweet_spot,
        'is_optimal_tempo': is_optimal_tempo,
        'pop_bean_shape_score': pop_bean_shape_score
    }

    # Print what the AI found
    print("\n🔬 MATH EXTRACTED FROM AUDIO:")
    for name, value in features_dict.items():
        print(f"  - {name.capitalize()}: {value:.4f}")
    
    if USE_2025:
        # 16-feature array for 2025 model
        features = np.array([[
            features_dict['danceability'], features_dict['energy'], features_dict['key'], 
            features_dict['loudness'], features_dict['mode'], features_dict['speechiness'],
            features_dict['acousticness'], features_dict['instrumentalness'], features_dict['liveness'], 
            features_dict['valence'], features_dict['tempo'], features_dict['duration_ms'], 
            features_dict['time_signature'], features_dict['is_streaming_sweet_spot'],
            features_dict['is_optimal_tempo'], features_dict['pop_bean_shape_score']
        ]])
    else:
        # 13-feature array for original model
        features = np.array([[
            features_dict['danceability'], features_dict['energy'], features_dict['key'], 
            features_dict['loudness'], features_dict['mode'], features_dict['speechiness'],
            features_dict['acousticness'], features_dict['instrumentalness'], features_dict['liveness'], 
            features_dict['valence'], features_dict['tempo'], features_dict['duration_ms'], 
            features_dict['time_signature']
        ]])
    
    return features

def predict_hit(audio_path):
    if model is None or scaler is None:
        print("Cannot predict without loaded models.")
        return 0.0

    # 1. Get the numbers from the audio
    features = extract_features(audio_path)
    
    # 2. Scale the numbers using the scaler from training
    features_scaled = scaler.transform(features)
    
    # 3. Ask the AI for the probability (0.0 to 1.0)
    probability = model.predict_proba(features_scaled)[0][1]
    
    hit_score = round(probability * 100, 1)
    
    print("\n======================================")
    print(f"🎵 AI HIT SCORE: {hit_score}%")
    if hit_score >= 70:
        print("🔥 The AI predicts this is a COMMERCIAL HIT!")
    elif hit_score >= 40:
        print("📈 This has potential, but might need a stronger hook.")
    else:
        print("🛑 This is likely an underground/niche track (Flop).")
    print("======================================\n")
    
    return hit_score

# Test it on a random audio file on your computer!
test_audio = os.path.join(current_dir, 'test_audio.mp3')
if os.path.exists(test_audio):
    predict_hit(test_audio)
else:
    print(f"Please provide an audio file at {test_audio} to test.")
