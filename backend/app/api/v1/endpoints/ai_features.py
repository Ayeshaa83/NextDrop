"""
AI-Powered Features Endpoints for NextDrop
------------------------------------------
1. /suggest-metadata  — Functional: returns Genre, Mood, BPM for a track
2. /performance-insight — Functional: compares two metric snapshots and returns NL insight
3. /territory-growth — Simulated: returns mock territory growth + reasoning
4. /release-timing   — Simulated: returns mock optimal release window
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import random

router = APIRouter()


# ──── Schemas ───────────────────────────────────────────────────────

class MetadataSuggestionRequest(BaseModel):
    audio_file_id: Optional[int] = None
    title: Optional[str] = None


class MetadataSuggestionResponse(BaseModel):
    genre: str
    mood: str
    bpm: int
    key: str
    energy: float
    danceability: float
    confidence: float


class PerformanceInsightRequest(BaseModel):
    track_title: str
    current_streams: int
    previous_streams: int
    current_saves: int = 0
    previous_saves: int = 0


class PerformanceInsightResponse(BaseModel):
    headline: str
    body: str
    trend: str  # "up" | "down" | "stable"
    percentage_change: float
    tip: str


class TerritoryGrowthItem(BaseModel):
    country: str
    country_code: str
    growth_percentage: float
    streams: int
    reason: str
    flag_emoji: str


class TerritoryGrowthResponse(BaseModel):
    territories: list[TerritoryGrowthItem]
    summary: str


class ReleaseWindow(BaseModel):
    day: str
    time_utc: str
    time_label: str
    score: float  # 0-100 how optimal


class ReleaseTimingResponse(BaseModel):
    golden_window: ReleaseWindow
    alternatives: list[ReleaseWindow]
    justification: str
    playlist_target: str


# ──── 1. Metadata Suggestion (Functional) ──────────────────────────

GENRE_POOL = [
    "Electronic", "Pop", "Hip-Hop", "Lo-Fi", "Indie", "R&B",
    "Phonk", "Afrobeats", "Future Bass", "Synthwave", "Drill",
    "Bollywood Pop", "Indian Classical Fusion", "K-Pop", "Latin Trap",
]

MOOD_POOL = [
    "Energetic", "Chill", "Dark", "Euphoric", "Melancholic",
    "Dreamy", "Aggressive", "Romantic", "Nostalgic", "Hypnotic",
    "Uplifting", "Introspective", "Cinematic", "Groovy",
]

KEY_POOL = [
    "C major", "A minor", "G major", "E minor", "D major",
    "B minor", "F major", "D minor", "Bb major", "F# minor",
    "Eb major", "C# minor", "Ab major",
]


@router.post("/suggest-metadata", response_model=MetadataSuggestionResponse)
async def suggest_metadata(req: MetadataSuggestionRequest):
    """
    Functional AI metadata suggestion.
    In production this would run an audio-feature extraction pipeline
    (librosa / essentia). For the poster demo, we use intelligent
    randomization seeded by the file ID so results are deterministic
    per track.
    """
    seed = (req.audio_file_id or 42) + hash(req.title or "")
    rng = random.Random(seed)

    genre = rng.choice(GENRE_POOL)
    mood = rng.choice(MOOD_POOL)
    bpm = rng.randint(72, 180)
    key = rng.choice(KEY_POOL)
    energy = round(rng.uniform(0.3, 1.0), 2)
    danceability = round(rng.uniform(0.2, 1.0), 2)
    confidence = round(rng.uniform(0.78, 0.98), 2)

    return MetadataSuggestionResponse(
        genre=genre,
        mood=mood,
        bpm=bpm,
        key=key,
        energy=energy,
        danceability=danceability,
        confidence=confidence,
    )


# ──── 2. Performance Insight (Functional / Logic-Based) ─────────────

@router.post("/performance-insight", response_model=PerformanceInsightResponse)
async def performance_insight(req: PerformanceInsightRequest):
    """
    Compares current vs previous metrics and generates a natural-language insight.
    """
    if req.previous_streams == 0:
        pct = 100.0
    else:
        pct = round(
            ((req.current_streams - req.previous_streams) / req.previous_streams) * 100,
            1,
        )

    trend = "up" if pct > 0 else "down" if pct < 0 else "stable"

    if pct >= 50:
        headline = f"🚀 \"{req.track_title}\" is on fire!"
        body = f"Your latest track grew {abs(pct)}% faster than your previous release! This velocity puts you in the top 5% of indie artists this week."
        tip = "Strike while the iron is hot — consider pushing a short-form clip to TikTok and Instagram Reels within the next 48 hours."
    elif pct >= 20:
        headline = f"📈 \"{req.track_title}\" is gaining momentum"
        body = f"Solid growth of +{abs(pct)}% compared to your last drop. Algorithmic playlists are starting to pick it up."
        tip = "Share your Spotify link in artist communities and Discord servers to accelerate the algorithmic push."
    elif pct >= 0:
        headline = f"🔄 \"{req.track_title}\" is holding steady"
        body = f"Your streams are up {abs(pct)}% — steady but room to grow. Engagement-per-listener is above average."
        tip = "Try releasing a behind-the-scenes video or remix snippet to re-engage your audience."
    else:
        headline = f"📊 \"{req.track_title}\" needs a push"
        body = f"Streams dipped {abs(pct)}% from your last release. This is normal for the mid-cycle — most artists see a rebound in week 3."
        tip = "Consider collaborating with a featured artist or running a 48-hour exclusive preview on SoundCloud."

    return PerformanceInsightResponse(
        headline=headline,
        body=body,
        trend=trend,
        percentage_change=pct,
        tip=tip,
    )


# ──── 3. Territory Growth (Simulated / Mock) ───────────────────────

MOCK_TERRITORIES = [
    TerritoryGrowthItem(
        country="Brazil",
        country_code="BR",
        growth_percentage=45.2,
        streams=128400,
        reason="Rhythmic match with local Funk Carioca trends. Your BPM range (120-135) aligns with Brazil's top playlists.",
        flag_emoji="🇧🇷",
    ),
    TerritoryGrowthItem(
        country="India",
        country_code="IN",
        growth_percentage=38.7,
        streams=95200,
        reason="Your fusion of electronic and classical elements resonates with the growing indie scene in Mumbai and Bangalore.",
        flag_emoji="🇮🇳",
    ),
    TerritoryGrowthItem(
        country="Germany",
        country_code="DE",
        growth_percentage=27.3,
        streams=67800,
        reason="Strong techno/electronic listener base. Your track appeared in 3 editorial playlists on Spotify DE.",
        flag_emoji="🇩🇪",
    ),
    TerritoryGrowthItem(
        country="Mexico",
        country_code="MX",
        growth_percentage=22.1,
        streams=54300,
        reason="Latin crossover appeal detected. The melodic hooks match current regional trending sounds.",
        flag_emoji="🇲🇽",
    ),
    TerritoryGrowthItem(
        country="Japan",
        country_code="JP",
        growth_percentage=18.4,
        streams=41200,
        reason="Lo-fi and synthwave elements are trending on Japanese streaming platforms. City-pop revival audience overlap.",
        flag_emoji="🇯🇵",
    ),
    TerritoryGrowthItem(
        country="United Kingdom",
        country_code="GB",
        growth_percentage=15.6,
        streams=38900,
        reason="Drill and bass music communities are sharing your track. UGC content detected on TikTok UK.",
        flag_emoji="🇬🇧",
    ),
    TerritoryGrowthItem(
        country="South Korea",
        country_code="KR",
        growth_percentage=12.8,
        streams=29400,
        reason="K-Pop adjacent production style. AI detected similar vocal processing to trending K-R&B artists.",
        flag_emoji="🇰🇷",
    ),
    TerritoryGrowthItem(
        country="Nigeria",
        country_code="NG",
        growth_percentage=31.5,
        streams=72100,
        reason="Afrobeats rhythmic DNA match. Your percussive patterns align with Amapiano-influenced playlists.",
        flag_emoji="🇳🇬",
    ),
]


@router.get("/territory-growth", response_model=TerritoryGrowthResponse)
async def territory_growth():
    """
    Returns simulated territory/platform growth data with AI reasoning.
    """
    return TerritoryGrowthResponse(
        territories=MOCK_TERRITORIES,
        summary="Your music is resonating strongest in emerging markets. Brazil and Nigeria show the highest algorithmic affinity based on rhythmic analysis.",
    )


# ──── 4. Release Timing (Simulated / Mock) ─────────────────────────

@router.get("/release-timing", response_model=ReleaseTimingResponse)
async def release_timing():
    """
    Returns the simulated 'Golden Window' for optimal release timing.
    """
    return ReleaseTimingResponse(
        golden_window=ReleaseWindow(
            day="Friday",
            time_utc="18:00",
            time_label="6:00 PM GMT",
            score=96.4,
        ),
        alternatives=[
            ReleaseWindow(day="Thursday", time_utc="22:00", time_label="10:00 PM GMT", score=78.2),
            ReleaseWindow(day="Wednesday", time_utc="14:00", time_label="2:00 PM GMT", score=65.8),
            ReleaseWindow(day="Saturday", time_utc="10:00", time_label="10:00 AM GMT", score=58.3),
            ReleaseWindow(day="Monday", time_utc="08:00", time_label="8:00 AM GMT", score=42.1),
            ReleaseWindow(day="Tuesday", time_utc="16:00", time_label="4:00 PM GMT", score=39.7),
            ReleaseWindow(day="Sunday", time_utc="20:00", time_label="8:00 PM GMT", score=35.4),
        ],
        justification="Recommended for maximum Algorithmic Spike on New Music Friday. Friday 6 PM GMT aligns with peak editorial playlist refresh windows across Spotify, Apple Music, and YouTube Music. Historical data shows 3.2x higher first-48-hour streams for releases in this window.",
        playlist_target="New Music Friday, Fresh Finds, Release Radar",
    )


# ──── 5. Audio DNA — 16 ML Feature Extraction ──────────────────────

class AudioFeature(BaseModel):
    name: str
    value: float       # normalized 0-100
    raw_value: float   # actual extracted value
    unit: str


class AudioDNACategory(BaseModel):
    category: str
    color: str         # hex color for the radar chart
    features: list[AudioFeature]


class AudioDNAResponse(BaseModel):
    track_title: str
    categories: list[AudioDNACategory]
    overall_quality: float  # 0-100


@router.post("/audio-dna")
async def audio_dna(req: MetadataSuggestionRequest) -> AudioDNAResponse:
    """
    Extracts 16 audio features grouped into 4 intuitive categories.
    In production: librosa spectral_centroid, onset_detect, chroma_stft,
    essentia MFCCs, etc. For demo: deterministic seeded values.
    """
    seed = (req.audio_file_id or 42) + hash(req.title or "untitled")
    rng = random.Random(seed)

    def rf(lo: float, hi: float) -> float:
        return round(rng.uniform(lo, hi), 2)

    categories = [
        AudioDNACategory(
            category="Rhythmic",
            color="#00f2fe",
            features=[
                AudioFeature(name="BPM", value=rf(40, 95), raw_value=rng.randint(72, 180), unit="bpm"),
                AudioFeature(name="Onset Rate", value=rf(30, 90), raw_value=rf(2.0, 12.0), unit="onsets/s"),
                AudioFeature(name="Syncopation", value=rf(20, 85), raw_value=rf(0.1, 0.9), unit="idx"),
                AudioFeature(name="Beat Strength", value=rf(45, 95), raw_value=rf(0.3, 1.0), unit="norm"),
            ],
        ),
        AudioDNACategory(
            category="Tonal",
            color="#6366f1",
            features=[
                AudioFeature(name="Key Clarity", value=rf(50, 95), raw_value=rf(0.5, 1.0), unit="corr"),
                AudioFeature(name="Chroma Energy", value=rf(35, 90), raw_value=rf(0.2, 0.95), unit="norm"),
                AudioFeature(name="Spectral Centroid", value=rf(25, 80), raw_value=rf(800, 5200), unit="Hz"),
                AudioFeature(name="Harmonic Ratio", value=rf(40, 92), raw_value=rf(0.3, 0.98), unit="ratio"),
            ],
        ),
        AudioDNACategory(
            category="Dynamic",
            color="#10b981",
            features=[
                AudioFeature(name="RMS Energy", value=rf(30, 88), raw_value=rf(0.02, 0.35), unit="rms"),
                AudioFeature(name="Spectral Rolloff", value=rf(35, 85), raw_value=rf(2000, 8000), unit="Hz"),
                AudioFeature(name="Peak Amplitude", value=rf(50, 95), raw_value=rf(0.6, 1.0), unit="dBFS"),
                AudioFeature(name="Dynamic Range", value=rf(25, 80), raw_value=rf(6, 24), unit="dB"),
            ],
        ),
        AudioDNACategory(
            category="Timbral",
            color="#a855f7",
            features=[
                AudioFeature(name="MFCC Spread", value=rf(30, 85), raw_value=rf(10, 45), unit="coeff"),
                AudioFeature(name="Zero-Cross Rate", value=rf(20, 75), raw_value=rf(0.02, 0.15), unit="rate"),
                AudioFeature(name="Brightness", value=rf(35, 90), raw_value=rf(0.2, 0.9), unit="norm"),
                AudioFeature(name="Roughness", value=rf(15, 70), raw_value=rf(0.05, 0.6), unit="idx"),
            ],
        ),
    ]

    # Overall quality = weighted average of all feature values
    all_vals = [f.value for c in categories for f in c.features]
    overall = round(sum(all_vals) / len(all_vals), 1)

    return AudioDNAResponse(
        track_title=req.title or "Untitled Track",
        categories=categories,
        overall_quality=overall,
    )
