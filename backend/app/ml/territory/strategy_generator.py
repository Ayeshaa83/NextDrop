from typing import Dict, Any
from .schemas import IndianPlatformType


class IndiaStrategyEngine:
    def generate_strategy(
        self,
        region_code: str,
        region_name: str,
        platform: IndianPlatformType,
        features: Dict[str, Any]
    ) -> str:
        
        reels_vel = features.get("reels_velocity", 0.0)
        save_rate = features.get("save_rate", 0.0)
        wow_growth = features.get("wow_growth", 0.0)

        if platform == IndianPlatformType.INSTAGRAM_REELS and reels_vel > 0.35:
            return f"Surging Instagram Reels audio usage in {region_name}. Collaborate with regional Hindi/Punjabi Reels creators for audio seeding."

        if platform in [IndianPlatformType.JIOSAAVN, IndianPlatformType.WYNK_MUSIC]:
            return f"Strong Tier-2/3 audience growth in {region_name} on {platform.value.replace('_', ' ').title()}. Pitch for JioSaavn Regional Rewind and Wynk Weekly Top 20."

        if region_code in ["MH", "DL", "KA"] and platform == IndianPlatformType.SPOTIFY_INDIA:
            return f"High urban active audience in {region_name}. Pitch to Spotify 'Indie India' & 'Radirr India' editorial playlists and plan local gig promo."

        if region_code in ["PB", "DL"] and features.get("genre_affinity", 0) > 0.85:
            return f"Dominant North India traction in {region_name}. Run targeted YouTube Shorts ads & outreach to regional music aggregators."

        if region_code in ["TN", "TS", "KL"]:
            return f"Growing South Indian listener base in {region_name}. Publish localized Tamil/Telugu lyric video cuts on YouTube Music."

        if wow_growth > 0.30:
            return f"Accelerating stream velocity in {region_name} on {platform.value.replace('_', ' ').title()}. Boost digital ad campaign allocation in this region."

        return f"Maintain organic community engagement across {region_name} on {platform.value.replace('_', ' ').title()}."