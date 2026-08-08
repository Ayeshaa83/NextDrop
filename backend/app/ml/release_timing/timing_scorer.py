from typing import List, Dict, Any, Tuple
from .schemas import DayOfWeek, TargetMarket, ReleaseWindowOption


# Day of Week Editorial Alignment Scores (0-100)
DAY_EDITORIAL_SCORES = {
    TargetMarket.INDIA_DOMESTIC: {
        DayOfWeek.FRIDAY: 100.0,    # Spotify/Apple NMF & JioSaavn Weekly Top 20
        DayOfWeek.THURSDAY: 85.0,   # Ideal for Reels virality ahead of weekend
        DayOfWeek.WEDNESDAY: 65.0,  # Mid-week indie release
        DayOfWeek.TUESDAY: 50.0,
        DayOfWeek.MONDAY: 45.0,
        DayOfWeek.SATURDAY: 35.0,
        DayOfWeek.SUNDAY: 30.0
    },
    TargetMarket.GLOBAL_CROSSOVER: {
        DayOfWeek.FRIDAY: 100.0,    # Billboard/Official Charts tracking starts Friday 00:00 EST
        DayOfWeek.THURSDAY: 75.0,
        DayOfWeek.WEDNESDAY: 55.0,
        DayOfWeek.TUESDAY: 40.0,
        DayOfWeek.MONDAY: 35.0,
        DayOfWeek.SATURDAY: 25.0,
        DayOfWeek.SUNDAY: 20.0
    }
}


# Genre-Specific Optimal Release Windows (Day & IST Time)
GENRE_TIMING_PROFILES = {
    "punjabi_pop": [
        (DayOfWeek.THURSDAY, "18:00 IST", 95.0, "Thurs evening launch captures weekend Reels & YouTube Shorts virality in North India"),
        (DayOfWeek.FRIDAY, "00:00 IST", 100.0, "Standard Friday midnight drop for Spotify New Music Friday India"),
        (DayOfWeek.WEDNESDAY, "17:00 IST", 75.0, "Mid-week teaser drop ahead of weekend Punjabi party playlists")
    ],
    "desi_hip_hop": [
        (DayOfWeek.FRIDAY, "00:00 IST", 100.0, "Standard midnight release for Rap 91 & Hip Hop India editorial playlists"),
        (DayOfWeek.THURSDAY, "19:00 IST", 90.0, "Thursday prime-time drop for Instagram Reels audio seeding"),
        (DayOfWeek.SATURDAY, "12:00 IST", 65.0, "Weekend afternoon drop for YouTube Music video premiere")
    ],
    "hindi_indie": [
        (DayOfWeek.FRIDAY, "00:00 IST", 100.0, "Aligns with Spotify 'Indie India' & Apple Music 'Indie Chill' refreshes"),
        (DayOfWeek.THURSDAY, "18:00 IST", 88.0, "Captures evening chill/commute stream hours in Mumbai/Delhi/Bengaluru"),
        (DayOfWeek.WEDNESDAY, "12:00 IST", 70.0, "Mid-week lunch hour release for organic acoustic sharing")
    ],
    "lofi_romantic": [
        (DayOfWeek.FRIDAY, "00:00 IST", 95.0, "Standard midnight release for Lofi India editorial inclusion"),
        (DayOfWeek.SUNDAY, "20:00 IST", 90.0, "Sunday evening relax/study peak streaming window"),
        (DayOfWeek.THURSDAY, "21:00 IST", 82.0, "Late-night Thursday commute listening hours")
    ],
    "bollywood_pop": [
        (DayOfWeek.FRIDAY, "00:00 IST", 100.0, "Maximum chart tracking alignment & JioSaavn/Wynk banner features"),
        (DayOfWeek.THURSDAY, "11:00 IST", 85.0, "Thursday morning press release & YouTube video premiere"),
        (DayOfWeek.TUESDAY, "17:00 IST", 60.0, "Early-week teaser Strategy")
    ]
}


class ReleaseTimingScorer:
    """Computes composite release timing scores based on editorial, audience, and lead time factors."""

    def score_release_windows(
        self,
        genre: str,
        target_market: TargetMarket,
        lead_time_days: int
    ) -> Tuple[bool, List[ReleaseWindowOption]]:
        
        editorial_eligible = (lead_time_days >= 14)
        profiles = GENRE_TIMING_PROFILES.get(genre.lower(), GENRE_TIMING_PROFILES["hindi_indie"])
        day_scores = DAY_EDITORIAL_SCORES.get(target_market, DAY_EDITORIAL_SCORES[TargetMarket.INDIA_DOMESTIC])

        window_options: List[ReleaseWindowOption] = []

        for day, time_ist, genre_score, reasoning in profiles:
            ed_score = day_scores.get(day, 50.0)
            
            # Lead time penalty: If lead time < 14 days, reduce editorial score by 35%
            if not editorial_eligible:
                ed_score *= 0.65

            aud_score = 90.0 if "18:00" in time_ist or "19:00" in time_ist or "00:00" in time_ist else 75.0

            # Composite weighted score
            composite = (ed_score * 0.40) + (aud_score * 0.35) + (genre_score * 0.25)
            composite = round(min(100.0, max(0.0, composite)), 1)

            reasons = [reasoning]
            if editorial_eligible:
                reasons.append("Lead time (≥14 days) qualifies track for Spotify & JioSaavn Editorial pitch consideration.")
            else:
                reasons.append(f"Short lead time ({lead_time_days} days) risks missing official editorial playlist pitching deadlines.")

            window_options.append(ReleaseWindowOption(
                rank=0,  # Will be assigned after sorting
                day_of_week=day,
                recommended_time_ist=time_ist,
                composite_score=composite,
                editorial_score=round(ed_score, 1),
                audience_score=round(aud_score, 1),
                genre_score=round(genre_score, 1),
                key_reasons=reasons,
                marketing_checklist=[]
            ))

        # Sort by composite score
        window_options.sort(key=lambda x: x.composite_score, reverse=True)
        for idx, opt in enumerate(window_options, 1):
            opt.rank = idx

        return editorial_eligible, window_options