"""
Tag Mapper — Maps raw Musicnn tags into structured categories.

Musicnn's MSD model produces tags like "guitar", "female singing", "beat",
"techno", "rock", etc. This module classifies them into:
  - Genre
  - Style
  - Mood
  - Instruments
  - Vocals
"""
from typing import Dict, List, Optional


# ─── Keyword → Category Mappings ────────────────────────────────────────────

GENRE_KEYWORDS: Dict[str, str] = {
    "rock": "Rock",
    "pop": "Pop",
    "hip hop": "Hip Hop",
    "rap": "Hip Hop",
    "electronic": "Electronic",
    "techno": "Techno",
    "house": "House",
    "jazz": "Jazz",
    "classical": "Classical",
    "country": "Country",
    "folk": "Folk",
    "metal": "Metal",
    "heavy metal": "Heavy Metal",
    "punk": "Punk",
    "blues": "Blues",
    "soul": "Soul",
    "r&b": "R&B",
    "reggae": "Reggae",
    "indie": "Indie",
    "alternative": "Alternative",
    "ambient": "Ambient",
    "dance": "Dance",
}

STYLE_KEYWORDS: Dict[str, str] = {
    "ambient": "Ambient",
    "slow": "Slow",
    "fast": "Upbeat",
    "hard": "Aggressive",
    "soft": "Soft",
    "quiet": "Quiet",
    "loud": "Loud",
    "beat": "Rhythmic",
    "beats": "Rhythmic",
    "classic": "Classic",
    "new age": "New Age",
    "choral": "Choral",
    "opera": "Operatic",
}

MOOD_KEYWORDS: Dict[str, str] = {
    "happy": "Happy",
    "sad": "Sad",
    "dark": "Dark",
    "bright": "Bright",
    "mellow": "Mellow",
    "aggressive": "Aggressive",
    "calm": "Calm",
    "energetic": "Energetic",
    "melancholic": "Melancholic",
    "chill": "Chill",
    "upbeat": "Upbeat",
}

INSTRUMENT_KEYWORDS: Dict[str, str] = {
    "guitar": "Guitar",
    "electric guitar": "Electric Guitar",
    "acoustic guitar": "Acoustic Guitar",
    "piano": "Piano",
    "synthesizer": "Synthesizer",
    "synth": "Synthesizer",
    "drums": "Drums",
    "drum": "Drums",
    "bass": "Bass",
    "violin": "Violin",
    "strings": "Strings",
    "flute": "Flute",
    "organ": "Organ",
    "harpsichord": "Harpsichord",
    "trumpet": "Trumpet",
    "saxophone": "Saxophone",
    "harmonica": "Harmonica",
}

VOCAL_KEYWORDS: Dict[str, str] = {
    "singing": "Vocals",
    "female singing": "Female Vocals",
    "male singing": "Male Vocals",
    "female voice": "Female Vocals",
    "male voice": "Male Vocals",
    "voice": "Vocals",
    "vocal": "Vocals",
    "choir": "Choir",
    "chant": "Chant",
    "rap": "Rap Vocals",
    "talk": "Spoken Word",
    "no singing": "Instrumental",
    "no voice": "Instrumental",
}


def _match_category(
    tag: str, keyword_map: Dict[str, str], threshold: float = 0.05
) -> Optional[str]:
    """Check if a tag matches any keyword in the map."""
    tag_lower = tag.lower().strip()
    # Exact match first
    if tag_lower in keyword_map:
        return keyword_map[tag_lower]
    # Partial match
    for keyword, label in keyword_map.items():
        if keyword in tag_lower or tag_lower in keyword:
            return label
    return None


def map_tags(raw_tags: List[Dict]) -> Dict:
    """
    Map a list of raw musicnn tags into structured categories.

    Args:
        raw_tags: List of {"tag": str, "score": float} dicts from tagger_musicnn.py

    Returns:
        Dict with keys: genre, style, mood, instruments, vocals
        Each value is a list of {"name": str, "confidence": int} (0-100)
    """
    genre_results: List[Dict] = []
    style_results: List[Dict] = []
    mood_results: List[Dict] = []
    instrument_results: List[Dict] = []
    vocal_results: List[Dict] = []

    seen_genres = set()
    seen_styles = set()
    seen_moods = set()
    seen_instruments = set()
    seen_vocals = set()

    for entry in raw_tags:
        tag = entry.get("tag", "")
        score = entry.get("score", 0.0)
        confidence = int(round(score * 100))

        if confidence < 3:  # Skip very low confidence tags
            continue

        # Try each category
        genre = _match_category(tag, GENRE_KEYWORDS)
        if genre and genre not in seen_genres:
            genre_results.append({"name": genre, "confidence": confidence})
            seen_genres.add(genre)

        style = _match_category(tag, STYLE_KEYWORDS)
        if style and style not in seen_styles:
            style_results.append({"name": style, "confidence": confidence})
            seen_styles.add(style)

        mood = _match_category(tag, MOOD_KEYWORDS)
        if mood and mood not in seen_moods:
            mood_results.append({"name": mood, "confidence": confidence})
            seen_moods.add(mood)

        instrument = _match_category(tag, INSTRUMENT_KEYWORDS)
        if instrument and instrument not in seen_instruments:
            instrument_results.append({"name": instrument, "confidence": confidence})
            seen_instruments.add(instrument)

        vocal = _match_category(tag, VOCAL_KEYWORDS)
        if vocal and vocal not in seen_vocals:
            vocal_results.append({"name": vocal, "confidence": confidence})
            seen_vocals.add(vocal)

    # Sort each by confidence descending
    for lst in [genre_results, style_results, mood_results, instrument_results, vocal_results]:
        lst.sort(key=lambda x: x["confidence"], reverse=True)

    return {
        "genre": genre_results[:5],
        "style": style_results[:5],
        "mood": mood_results[:5],
        "instruments": instrument_results[:8],
        "vocals": vocal_results[:3],
    }
