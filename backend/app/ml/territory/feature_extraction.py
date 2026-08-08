import numpy as np
from typing import List, Dict, Tuple, Any
from .schemas import TrackIndiaTerritoryAnalytics, RegionalWeeklyStats, IndianPlatformType


INDIAN_REGIONS = {
    "MH": "Maharashtra (Mumbai)",
    "PB": "Punjab & North India",
    "DL": "Delhi NCR",
    "KA": "Karnataka (Bengaluru)",
    "TN": "Tamil Nadu (Chennai)",
    "TS": "Telangana (Hyderabad)",
    "WB": "West Bengal (Kolkata)",
    "GJ": "Gujarat",
    "KL": "Kerala"
}

# Indian Genre to State Affinity Scores
INDIAN_GENRE_AFFINITY = {
    "punjabi_pop": {"PB": 0.98, "DL": 0.92, "MH": 0.80, "GJ": 0.70},
    "hindi_indie": {"MH": 0.95, "DL": 0.95, "KA": 0.90, "WB": 0.85},
    "desi_hip_hop": {"DL": 0.98, "MH": 0.95, "PB": 0.88, "KA": 0.82},
    "bollywood_pop": {"MH": 0.95, "DL": 0.90, "GJ": 0.88, "WB": 0.82, "PB": 0.80},
    "south_kollywood_tollywood": {"TN": 0.98, "TS": 0.98, "KA": 0.88, "KL": 0.88},
    "lofi_romantic": {"MH": 0.90, "DL": 0.90, "WB": 0.88, "KA": 0.85}
}


class IndiaTerritoryFeatureExtractor:
    def extract_region_platform_features(
        self, analytics: TrackIndiaTerritoryAnalytics
    ) -> Tuple[bool, List[Dict[str, Any]]]:
        
        total_global_streams = sum(s.streams for s in analytics.regional_series)
        if total_global_streams < 100:
            return False, []

        grouped: Dict[Tuple[str, IndianPlatformType], List[RegionalWeeklyStats]] = {}
        for item in analytics.regional_series:
            key = (item.region_code.upper(), item.platform)
            grouped.setdefault(key, []).append(item)

        feature_rows = []

        for (region_code, platform), series in grouped.items():
            sorted_series = sorted(series, key=lambda x: x.week_index)
            if len(sorted_series) < 2:
                continue

            w0 = sorted_series[0]
            w1 = sorted_series[1]

            wow_growth = (w0.streams - w1.streams) / max(1, w1.streams)
            save_rate = w0.saves / max(1, w0.streams)
            reels_velocity = (w0.reels_ugc_count - w1.reels_ugc_count) / max(1, w1.reels_ugc_count) if w1.reels_ugc_count > 0 else float(w0.reels_ugc_count > 0)
            engagement_per_stream = (w0.saves + w0.reels_ugc_count) / max(1, w0.streams)

            stream_history = [s.streams for s in sorted_series[:4]]
            if len(stream_history) >= 2:
                slope = np.polyfit(np.arange(len(stream_history)), stream_history[::-1], 1)[0]
                normalized_slope = float(slope / max(1, np.mean(stream_history)))
            else:
                normalized_slope = 0.0

            genre_map = INDIAN_GENRE_AFFINITY.get(analytics.genre.lower(), {})
            genre_affinity = genre_map.get(region_code, 0.65)

            feature_rows.append({
                "region_code": region_code,
                "region_name": INDIAN_REGIONS.get(region_code, region_code),
                "platform": platform,
                "current_streams": float(w0.streams),
                "wow_growth": float(wow_growth),
                "save_rate": float(save_rate),
                "reels_velocity": float(reels_velocity),
                "engagement_per_stream": float(engagement_per_stream),
                "normalized_slope": float(normalized_slope),
                "genre_affinity": float(genre_affinity)
            })

        return True, feature_rows