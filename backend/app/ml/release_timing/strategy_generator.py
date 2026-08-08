from typing import List
from .schemas import DayOfWeek, TargetMarket


class ReleaseChecklistEngine:
    """Generates actionable pre-release checklists based on release day and lead time."""

    def generate_checklist(
        self,
        day_of_week: DayOfWeek,
        recommended_time_ist: str,
        lead_time_days: int,
        target_market: TargetMarket
    ) -> List[str]:
        
        checklist = []

        if lead_time_days >= 14:
            checklist.append("Submit track metadata via Spotify for Artists Pitching Tool at least 14 days prior.")
            checklist.append("Submit track to JioSaavn & Wynk Music distributor portal for regional banner placement.")
        else:
            checklist.append("⚠️ Lead time is under 14 days: Submit metadata to distributor immediately to avoid delivery delays.")

        if day_of_week == DayOfWeek.FRIDAY:
            checklist.append(f"Schedule distributor release time for {recommended_time_ist} to align with midnight chart refreshes.")
            checklist.append("Upload 15-second teaser audio to Instagram Reels & TikTok 24 hours prior (Thursday 18:00 IST).")
            checklist.append("Prepare Spotify Canvas & Apple Music Animated Artwork 5 days prior to release.")

        elif day_of_week == DayOfWeek.THURSDAY:
            checklist.append(f"Set release time for {recommended_time_ist} to seed Instagram Reels audio ahead of weekend viral trends.")
            checklist.append("Schedule YouTube Shorts teaser premiere for Thursday afternoon.")

        else:
            checklist.append(f"Set distributor delivery for {recommended_time_ist}.")
            checklist.append("Announce release on Instagram Stories 24 hours prior with pre-save smart link.")

        if target_market == TargetMarket.GLOBAL_CROSSOVER:
            checklist.append("Ensure distributor sets 00:00 EST / 00:00 Local time release strategy for global chart alignment.")

        return checklist