import requests
from datetime import datetime, timezone
import math
from app.sec.config import settings

def calculate_viral_velocity(reels_count: int, avg_sentiment: float, uploaded_at: datetime) -> float:
    """
    Core Viral Velocity Algorithm.
    score = (Number of Reels * Average Sentiment Score) / Time since upload (in days)
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    uploaded_at_naive = uploaded_at.replace(tzinfo=None)
    
    delta = now - uploaded_at_naive
    days_since_upload = max(delta.total_seconds() / 86400.0, 0.5) # Minimum half a day to avoid zero division
    
    velocity = (reels_count * avg_sentiment) / days_since_upload
    return round(velocity, 2)

def generate_prescriptive_suggestion(velocity: float, top_region: str) -> str:
    if velocity > 500:
        return f"Viral spike detected in {top_region}. Shift marketing budget entirely to localized TikTok/Reel ads in {top_region}."
    elif velocity > 200:
        return f"High velocity detected in {top_region}; consider collaborating with micro-influencers there."
    elif velocity > 50:
        return f"Steady organic growth. Maintain regular posting schedule. {top_region} is showing promise."
    else:
        return "Velocity is lower than average. Consider running an Open Verse Challenge or a Remix contest to kickstart user-generated content."

def process_instagram_insights(track_upload_date: datetime):
    """
    Service to fetch real Instagram Data and compute Viral Velocity.
    Falls back to a demo/simulation logic if DEMO_MODE is True or real data fails.
    """
    if settings.DEMO_MODE:
        return {
            "reels_count": 8420,
            "sentiment_score": 0.88,
            "top_region": "Brazil"
        }
        
    access_token = settings.INSTAGRAM_ACCESS_TOKEN
    account_id = settings.INSTAGRAM_ACCOUNT_ID
    url = f"https://graph.facebook.com/v18.0/{account_id}/insights?metric=reach,impressions&period=day&access_token={access_token}"
    
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        
        # Simplified Instagram API extraction logic for Reels and sentiment mapping
        # In a real app this would call specific endpoints for Audio / Media Insights
        if "data" not in data or not data["data"]:
            raise ValueError("No data returned")
            
        real_reach = data["data"][0]["values"][0]["value"]
        if real_reach == 0:
            raise ValueError("Zero reach")
            
        return {
            "reels_count": int(real_reach / 100),  # Rough proxy for demo
            "sentiment_score": 0.75,
            "top_region": "United States"
        }
    except Exception:
        # Fallback if the Instagram API isn't linked yet or errors out
        return {
            "reels_count": 8420,
            "sentiment_score": 0.88,
            "top_region": "Brazil"
        }
