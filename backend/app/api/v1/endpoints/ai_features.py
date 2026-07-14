"""
AI-Powered Features Endpoints for NextDrop
------------------------------------------
Each endpoint is data-driven where the artist has real analytics, uses the
Claude API (app/services/llm_insights.py) for natural-language generation,
and degrades gracefully to deterministic heuristics when no LLM key is
configured or no data exists yet.

1. /suggest-metadata    — LLM metadata quality review (fallback: seeded random)
2. /performance-insight — NL insight from real metric deltas (fallback: rule-based)
3. /territory-growth    — real territory stats + LLM reasoning (fallback: mock list)
4. /release-timing      — data-driven golden window + LLM justification
5. /audio-dna           — 16-feature radar (deterministic demo values)
6. /trends              — platform-wide genre trends + LLM recommendation
"""
import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import random

from app.api import deps
from app.crud import analytics as analytics_crud
from app.crud import artist as artist_crud
from app.models import User, Track, TrackAnalytics, AnalyticsSnapshot
from app.services import llm_insights

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


class GenreTrend(BaseModel):
    genre: str
    total_streams: int
    recent_streams: int
    growth_percentage: float


class TrendsResponse(BaseModel):
    trends: list[GenreTrend]
    recommendation: str


def _country_name(code: str) -> str:
    NAMES = {
        "IN": "India", "US": "United States", "GB": "United Kingdom",
        "DE": "Germany", "BR": "Brazil", "JP": "Japan", "KR": "South Korea",
        "AU": "Australia", "MX": "Mexico", "NG": "Nigeria", "FR": "France",
        "CA": "Canada", "ES": "Spain", "ID": "Indonesia", "PH": "Philippines",
    }
    return NAMES.get(code, code)


def _flag_emoji(code: str) -> str:
    if len(code) != 2 or not code.isalpha():
        return "🌍"
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in code.upper())


# ──── 1. Metadata Suggestion ────────────────────────────────────────

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


def _fallback_metadata(req: MetadataSuggestionRequest) -> MetadataSuggestionResponse:
    seed = (req.audio_file_id or 42) + hash(req.title or "")
    rng = random.Random(seed)
    return MetadataSuggestionResponse(
        genre=rng.choice(GENRE_POOL),
        mood=rng.choice(MOOD_POOL),
        bpm=rng.randint(72, 180),
        key=rng.choice(KEY_POOL),
        energy=round(rng.uniform(0.3, 1.0), 2),
        danceability=round(rng.uniform(0.2, 1.0), 2),
        confidence=round(rng.uniform(0.78, 0.98), 2),
    )


@router.post("/suggest-metadata", response_model=MetadataSuggestionResponse)
async def suggest_metadata(
    req: MetadataSuggestionRequest,
    db: Session = Depends(deps.get_db),
):
    """
    Metadata quality assistance. When the referenced track has real ML
    analysis, Claude reviews it and fills the gaps; otherwise a
    deterministic heuristic keeps the flow working.
    """
    track = None
    if req.audio_file_id:
        track = db.query(Track).filter(Track.id == req.audio_file_id).first()

    context_lines = [f"Track title: {req.title or (track.title if track else 'Untitled')}"]
    if track:
        context_lines.append(f"Existing genre tag: {track.genre or 'MISSING'}")
        context_lines.append(f"Existing BPM tag: {track.bpm or 'MISSING'}")
        if isinstance(track.ai_analysis, dict):
            context_lines.append(f"ML audio analysis: {track.ai_analysis}")

    result = llm_insights.generate_json(
        "Review this track's metadata and suggest complete, high-quality tags "
        "for distribution. Fill in anything missing or weak. Base BPM/key on "
        "the ML analysis when present.\n\n" + "\n".join(context_lines),
        schema={
            "type": "object",
            "properties": {
                "genre": {"type": "string"},
                "mood": {"type": "string"},
                "bpm": {"type": "integer"},
                "key": {"type": "string"},
                "energy": {"type": "number"},
                "danceability": {"type": "number"},
                "confidence": {"type": "number"},
            },
            "required": ["genre", "mood", "bpm", "key", "energy", "danceability", "confidence"],
            "additionalProperties": False,
        },
    )
    if result:
        try:
            return MetadataSuggestionResponse(**result)
        except Exception:
            pass
    return _fallback_metadata(req)


# ──── 2. Performance Insight ────────────────────────────────────────

def _fallback_insight(req: PerformanceInsightRequest, pct: float, trend: str) -> PerformanceInsightResponse:
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
        headline=headline, body=body, trend=trend, percentage_change=pct, tip=tip,
    )


@router.post("/performance-insight", response_model=PerformanceInsightResponse)
async def performance_insight(req: PerformanceInsightRequest):
    """
    Compares current vs previous metrics and generates a natural-language
    insight — LLM-written when available, rule-based otherwise.
    """
    if req.previous_streams == 0:
        pct = 100.0
    else:
        pct = round(
            ((req.current_streams - req.previous_streams) / req.previous_streams) * 100,
            1,
        )
    trend = "up" if pct > 0 else "down" if pct < 0 else "stable"

    result = llm_insights.generate_json(
        f"Write a performance insight for the track \"{req.track_title}\".\n"
        f"Current period streams: {req.current_streams}\n"
        f"Previous period streams: {req.previous_streams}\n"
        f"Current saves: {req.current_saves}, previous saves: {req.previous_saves}\n"
        f"Computed change: {pct}% ({trend}).\n"
        "Produce a short punchy headline (may start with one fitting emoji), a "
        "2-sentence body grounded in these numbers, and one concrete next-step tip.",
        schema={
            "type": "object",
            "properties": {
                "headline": {"type": "string"},
                "body": {"type": "string"},
                "tip": {"type": "string"},
            },
            "required": ["headline", "body", "tip"],
            "additionalProperties": False,
        },
        max_tokens=700,
    )
    if result:
        return PerformanceInsightResponse(
            headline=result["headline"], body=result["body"], tip=result["tip"],
            trend=trend, percentage_change=pct,
        )
    return _fallback_insight(req, pct, trend)


# ──── 3. Territory Growth ───────────────────────────────────────────

MOCK_TERRITORIES = [
    TerritoryGrowthItem(country="Brazil", country_code="BR", growth_percentage=45.2, streams=128400,
                        reason="Rhythmic match with local Funk Carioca trends. Your BPM range (120-135) aligns with Brazil's top playlists.", flag_emoji="🇧🇷"),
    TerritoryGrowthItem(country="India", country_code="IN", growth_percentage=38.7, streams=95200,
                        reason="Your fusion of electronic and classical elements resonates with the growing indie scene in Mumbai and Bangalore.", flag_emoji="🇮🇳"),
    TerritoryGrowthItem(country="Germany", country_code="DE", growth_percentage=27.3, streams=67800,
                        reason="Strong techno/electronic listener base. Your track appeared in 3 editorial playlists on Spotify DE.", flag_emoji="🇩🇪"),
    TerritoryGrowthItem(country="Mexico", country_code="MX", growth_percentage=22.1, streams=54300,
                        reason="Latin crossover appeal detected. The melodic hooks match current regional trending sounds.", flag_emoji="🇲🇽"),
    TerritoryGrowthItem(country="Japan", country_code="JP", growth_percentage=18.4, streams=41200,
                        reason="Lo-fi and synthwave elements are trending on Japanese streaming platforms. City-pop revival audience overlap.", flag_emoji="🇯🇵"),
    TerritoryGrowthItem(country="United Kingdom", country_code="GB", growth_percentage=15.6, streams=38900,
                        reason="Drill and bass music communities are sharing your track. UGC content detected on TikTok UK.", flag_emoji="🇬🇧"),
    TerritoryGrowthItem(country="South Korea", country_code="KR", growth_percentage=12.8, streams=29400,
                        reason="K-Pop adjacent production style. AI detected similar vocal processing to trending K-R&B artists.", flag_emoji="🇰🇷"),
    TerritoryGrowthItem(country="Nigeria", country_code="NG", growth_percentage=31.5, streams=72100,
                        reason="Afrobeats rhythmic DNA match. Your percussive patterns align with Amapiano-influenced playlists.", flag_emoji="🇳🇬"),
]


@router.get("/territory-growth", response_model=TerritoryGrowthResponse)
async def territory_growth(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Territory growth from the artist's real analytics snapshots, with
    Claude-written explanations. Falls back to demo data when the artist
    has no country-attributed streams yet.
    """
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    real = analytics_crud.get_territories(db, artist_id=artist.id) if artist else []

    if not real:
        return TerritoryGrowthResponse(
            territories=MOCK_TERRITORIES,
            summary="Demo data — territory insights become personalised once your streams include regional attribution.",
        )

    top = real[:8]
    genres = [g for (g,) in db.query(Track.genre).filter(
        Track.artist_id == artist.id, Track.genre.isnot(None)
    ).distinct().all()]

    llm = llm_insights.generate_json(
        "For each territory below, write ONE specific sentence explaining the "
        "growth pattern for this independent artist, and a one-sentence overall "
        f"summary. Artist genres: {', '.join(genres) or 'unknown'}.\n\n"
        + "\n".join(
            f"- {_country_name(t['country'])} ({t['country']}): "
            f"{t['streams']} streams last 30d, {t['growth_percentage']}% vs previous 30d"
            for t in top
        ),
        schema={
            "type": "object",
            "properties": {
                "reasons": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "country_code": {"type": "string"},
                            "reason": {"type": "string"},
                        },
                        "required": ["country_code", "reason"],
                        "additionalProperties": False,
                    },
                },
                "summary": {"type": "string"},
            },
            "required": ["reasons", "summary"],
            "additionalProperties": False,
        },
    )

    reason_map = {}
    summary = None
    if llm:
        reason_map = {r["country_code"]: r["reason"] for r in llm.get("reasons", [])}
        summary = llm.get("summary")

    items = [
        TerritoryGrowthItem(
            country=_country_name(t["country"]),
            country_code=t["country"],
            growth_percentage=t["growth_percentage"],
            streams=t["streams"],
            reason=reason_map.get(
                t["country"],
                f"{t['streams']} streams in the last 30 days "
                f"({'+' if t['growth_percentage'] >= 0 else ''}{t['growth_percentage']}% vs the previous month).",
            ),
            flag_emoji=_flag_emoji(t["country"]),
        )
        for t in top
    ]
    return TerritoryGrowthResponse(
        territories=items,
        summary=summary or f"Your strongest market right now is {items[0].country}, with {items[0].streams} streams in the last 30 days.",
    )


# ──── 4. Release Timing ─────────────────────────────────────────────

_FALLBACK_TIMING = ReleaseTimingResponse(
    golden_window=ReleaseWindow(day="Friday", time_utc="18:00", time_label="6:00 PM GMT", score=96.4),
    alternatives=[
        ReleaseWindow(day="Thursday", time_utc="22:00", time_label="10:00 PM GMT", score=78.2),
        ReleaseWindow(day="Wednesday", time_utc="14:00", time_label="2:00 PM GMT", score=65.8),
        ReleaseWindow(day="Saturday", time_utc="10:00", time_label="10:00 AM GMT", score=58.3),
        ReleaseWindow(day="Monday", time_utc="08:00", time_label="8:00 AM GMT", score=42.1),
        ReleaseWindow(day="Tuesday", time_utc="16:00", time_label="4:00 PM GMT", score=39.7),
        ReleaseWindow(day="Sunday", time_utc="20:00", time_label="8:00 PM GMT", score=35.4),
    ],
    justification="Industry default: Friday 6 PM GMT aligns with New Music Friday playlist refresh windows across Spotify, Apple Music, and YouTube Music. Personalised timing appears once you have streaming history.",
    playlist_target="New Music Friday, Fresh Finds, Release Radar",
)

_DAY_TIMES = {
    "Monday": ("08:00", "8:00 AM GMT"), "Tuesday": ("16:00", "4:00 PM GMT"),
    "Wednesday": ("14:00", "2:00 PM GMT"), "Thursday": ("22:00", "10:00 PM GMT"),
    "Friday": ("18:00", "6:00 PM GMT"), "Saturday": ("10:00", "10:00 AM GMT"),
    "Sunday": ("20:00", "8:00 PM GMT"),
}


@router.get("/release-timing", response_model=ReleaseTimingResponse)
async def release_timing(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Optimal release window from the artist's own day-of-week engagement
    history, with an LLM-written justification. Industry-default fallback
    when there is no history yet.
    """
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        return _FALLBACK_TIMING

    since = datetime.date.today() - datetime.timedelta(days=90)
    rows = (
        db.query(AnalyticsSnapshot.snapshot_date, func.sum(AnalyticsSnapshot.streams))
        .join(Track, Track.id == AnalyticsSnapshot.track_id)
        .filter(Track.artist_id == artist.id, AnalyticsSnapshot.snapshot_date >= since)
        .group_by(AnalyticsSnapshot.snapshot_date)
        .all()
    )
    if not rows:
        return _FALLBACK_TIMING

    day_totals: dict[str, int] = {}
    for snap_date, streams in rows:
        day = snap_date.strftime("%A")
        day_totals[day] = day_totals.get(day, 0) + int(streams)

    max_streams = max(day_totals.values()) or 1
    ranked = sorted(day_totals.items(), key=lambda kv: kv[1], reverse=True)

    def window(day: str, streams: int) -> ReleaseWindow:
        time_utc, time_label = _DAY_TIMES.get(day, ("18:00", "6:00 PM GMT"))
        return ReleaseWindow(
            day=day, time_utc=time_utc, time_label=time_label,
            score=round(streams / max_streams * 100, 1),
        )

    golden = window(*ranked[0])
    alternatives = [window(d, s) for d, s in ranked[1:]]

    llm = llm_insights.generate_json(
        "Justify a release-timing recommendation for an independent artist "
        "based on their own listener activity by day of week (last 90 days):\n"
        + "\n".join(f"- {d}: {s} streams" for d, s in ranked)
        + f"\nRecommended window: {golden.day} {golden.time_label}. "
        "Write a 2-sentence justification referencing their data, and name "
        "2-3 playlist targets appropriate for an indie release.",
        schema={
            "type": "object",
            "properties": {
                "justification": {"type": "string"},
                "playlist_target": {"type": "string"},
            },
            "required": ["justification", "playlist_target"],
            "additionalProperties": False,
        },
        max_tokens=600,
    )

    return ReleaseTimingResponse(
        golden_window=golden,
        alternatives=alternatives,
        justification=(llm or {}).get(
            "justification",
            f"{golden.day} is your strongest listening day ({ranked[0][1]} streams over the last 90 days). "
            "Releasing just before your audience's peak activity maximises first-48-hour velocity.",
        ),
        playlist_target=(llm or {}).get("playlist_target", "Release Radar, Fresh Finds"),
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


# ──── 6. Trend Detection ────────────────────────────────────────────

@router.get("/trends", response_model=TrendsResponse)
async def genre_trends(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Platform-wide genre trend detection: aggregates streams by genre across
    all public tracks, computes 30-day growth, and asks Claude for a
    style/platform recommendation tailored to this artist.
    """
    # Lifetime totals per genre
    totals = dict(
        db.query(Track.genre, func.coalesce(func.sum(TrackAnalytics.stream_count), 0))
        .join(TrackAnalytics, TrackAnalytics.track_id == Track.id)
        .filter(Track.genre.isnot(None))
        .group_by(Track.genre)
        .all()
    )

    # Last 30 days vs previous 30 days from snapshots
    today = datetime.date.today()
    def genre_window(start, end):
        return dict(
            db.query(Track.genre, func.coalesce(func.sum(AnalyticsSnapshot.streams), 0))
            .join(AnalyticsSnapshot, AnalyticsSnapshot.track_id == Track.id)
            .filter(
                Track.genre.isnot(None),
                AnalyticsSnapshot.snapshot_date >= start,
                AnalyticsSnapshot.snapshot_date <= end,
            )
            .group_by(Track.genre)
            .all()
        )

    recent = genre_window(today - datetime.timedelta(days=29), today)
    previous = genre_window(today - datetime.timedelta(days=59), today - datetime.timedelta(days=30))

    trends = []
    for genre, total in totals.items():
        rec = int(recent.get(genre, 0))
        prev = int(previous.get(genre, 0))
        growth = round(((rec - prev) / prev) * 100, 1) if prev > 0 else (100.0 if rec else 0.0)
        trends.append(GenreTrend(
            genre=genre, total_streams=int(total),
            recent_streams=rec, growth_percentage=growth,
        ))
    trends.sort(key=lambda t: (t.recent_streams, t.total_streams), reverse=True)
    trends = trends[:10]

    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    my_genres = []
    if artist:
        my_genres = [g for (g,) in db.query(Track.genre).filter(
            Track.artist_id == artist.id, Track.genre.isnot(None)
        ).distinct().all()]

    recommendation = None
    if trends:
        llm = llm_insights.generate_json(
            "Platform-wide genre performance on NextDrop:\n"
            + "\n".join(
                f"- {t.genre}: {t.total_streams} lifetime streams, "
                f"{t.recent_streams} in the last 30d ({t.growth_percentage}% growth)"
                for t in trends
            )
            + f"\n\nThis artist's genres: {', '.join(my_genres) or 'none yet'}.\n"
            "In 2-3 sentences, recommend which styles or platforms this artist "
            "should lean into next, grounded in the trend data.",
            schema={
                "type": "object",
                "properties": {"recommendation": {"type": "string"}},
                "required": ["recommendation"],
                "additionalProperties": False,
            },
            max_tokens=500,
        )
        recommendation = (llm or {}).get("recommendation")

    if not recommendation:
        if trends:
            hot = max(trends, key=lambda t: t.growth_percentage)
            recommendation = (
                f"{hot.genre} is the fastest-growing genre on the platform right now "
                f"({'+' if hot.growth_percentage >= 0 else ''}{hot.growth_percentage}% in 30 days). "
                "Consider a release or collaboration in that space."
            )
        else:
            recommendation = "Not enough platform data yet to detect trends — check back after more releases go live."

    return TrendsResponse(trends=trends, recommendation=recommendation)
