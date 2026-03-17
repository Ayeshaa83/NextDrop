from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.sec.config import settings
from sqlalchemy import text
from app.db.session import engine
from app.api.v1.endpoints import auth, artists, tracks, albums, analytics, social, storage, admin, spotify_auth, youtube_auth, feed
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

@app.get("/")
def read_root():
    return {"message": "Welcome to NextDrop API!", "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
