from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.sec.config import settings
from sqlalchemy import text
from app.db.session import engine
from app.api.v1.endpoints import auth, artists, tracks, albums, analytics, social, storage, admin, spotify_auth, youtube_auth, feed, ai_features
from app import models 

app = FastAPI(title="NextDrop API", description="Artist-First Music Distribution & Analytics Platform")

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Routes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

# Artist Routes
app.include_router(artists.router, prefix="/api/v1/artists", tags=["Artists"])

# Music Routes
app.include_router(tracks.router, prefix="/api/v1/tracks", tags=["Tracks"])
app.include_router(albums.router, prefix="/api/v1/albums", tags=["Albums"])

# Analytics Routes
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])

# Social Routes
app.include_router(social.router, prefix="/api/v1/social", tags=["Social"])

# Feed Routes (Jam Jar / Open Verse)
app.include_router(feed.router, prefix="/api/v1/feed", tags=["Feed"])

# Storage Routes (Presigned URLs)
app.include_router(storage.router, prefix="/api/v1/storage", tags=["Storage"])

# Admin Routes (RBAC protected)
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

# Spotify OAuth Routes
app.include_router(spotify_auth.router, prefix="/api/v1/spotify", tags=["Spotify OAuth"])

# YouTube OAuth Routes
app.include_router(youtube_auth.router, prefix="/api/v1/youtube", tags=["YouTube OAuth"])

# AI-Powered Features Routes
app.include_router(ai_features.router, prefix="/api/ai", tags=["AI Features"])

import requests
import random

from app.services.viral_velocity import process_instagram_insights, calculate_viral_velocity, generate_prescriptive_suggestion
from datetime import datetime, timedelta

@app.get("/api/analytics/viral-velocity")
def get_viral_velocity(track_id: int = 1):
    # Simulated upload date 7 days ago
    uploaded_at = datetime.now() - timedelta(days=7)
    
    # Process IG Insights
    ig_data = process_instagram_insights(uploaded_at)
    
    # Calculate Velocity
    velocity = calculate_viral_velocity(
        reels_count=ig_data["reels_count"],
        avg_sentiment=ig_data["sentiment_score"],
        uploaded_at=uploaded_at
    )
    
    # Get Prescriptive Suggestion
    suggestion = generate_prescriptive_suggestion(velocity, ig_data["top_region"])
    
    return {
        "status": "success",
        "viral_velocity_score": velocity,
        "raw_reach": ig_data["reels_count"] * 100,
        "suggestion": suggestion,
        "top_region": ig_data["top_region"],
        "is_simulated": settings.DEMO_MODE
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to NextDrop API!", "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
