from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.sec.config import settings
from app.api.v1.endpoints import (
    auth, artists, tracks, albums, analytics, social,
    storage, admin, spotify_auth, youtube_auth, google_auth, feed, ai_features, integrations,
    distribution, earnings, notifications,
)
from app import models  # noqa: F401 — ensures models are registered with SQLAlchemy
from app.sec.rate_limiter import limiter  # noqa: imported here for app.state binding

from app.api.ai_features import router as ai_router

# ── Rate Limiter ─────────────────────────────────────────────────────────────
# limiter singleton is defined in app.sec.rate_limiter to avoid circular imports

# NOTE: there is deliberately no background scheduler here. A fixed "refresh
# every N minutes" job doesn't scale — YouTube's Data API v3 caps usage at a
# daily quota (commonly 10,000 units/day; videos.list costs 1 unit/call), so
# a job refreshing every live video on a fixed interval would grow with the
# catalog and eventually exceed it. Analytics refresh is manual-only for now
# (the "Refresh Analytics" button, plus an on-page-visit check capped at once
# per 15 minutes) — revisit with quota-aware batching once deployed for real.

app = FastAPI(
    title="NextDrop API",
    description="Artist-First Music Distribution & Analytics Platform",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Custom ML engines router (metadata/insights/territory/release timing)
app.include_router(ai_router, prefix="/api")

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://f4ko0gg08wgo00wg08gow0ww.78.46.171.125.sslip.io",
    frontend_url,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://.*",  # Dynamically allows any http/https origin with credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ──────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(google_auth.router, prefix="/api/v1/auth/google", tags=["Google Sign-In"])

# ── Artist ────────────────────────────────────────────────────────────────────
app.include_router(artists.router, prefix="/api/v1/artists", tags=["Artists"])

# ── Music ─────────────────────────────────────────────────────────────────────
app.include_router(tracks.router, prefix="/api/v1/tracks", tags=["Tracks"])
app.include_router(albums.router, prefix="/api/v1/albums", tags=["Albums"])
app.include_router(distribution.router, prefix="/api/v1/distribution", tags=["Distribution"])

# ── Analytics ─────────────────────────────────────────────────────────────────
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])

# ── Earnings & Payouts ────────────────────────────────────────────────────────
app.include_router(earnings.router, prefix="/api/v1/earnings", tags=["Earnings"])

# ── Notifications ─────────────────────────────────────────────────────────────
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])

# ── Social ────────────────────────────────────────────────────────────────────
app.include_router(social.router, prefix="/api/v1/social", tags=["Social"])

# ── Feed (Jam Jar / Open Verse) ───────────────────────────────────────────────
app.include_router(feed.router, prefix="/api/v1/feed", tags=["Feed"])

# ── Storage (Presigned URLs) ──────────────────────────────────────────────────
app.include_router(storage.router, prefix="/api/v1/storage", tags=["Storage"])

# ── Admin (RBAC protected) ────────────────────────────────────────────────────
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

# ── Platform OAuth ────────────────────────────────────────────────────────────
app.include_router(spotify_auth.router, prefix="/api/v1/spotify", tags=["Spotify OAuth"])
app.include_router(youtube_auth.router, prefix="/api/v1/youtube", tags=["YouTube OAuth"])

# ── Integrations Hub (Platform Registry) ─────────────────────────────────────
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations"])

# ── Old AI Features Router (handles legacy frontend calls like audio-dna/trends) ──
app.include_router(ai_features.router, prefix="/api/ai", tags=["AI Features"])

# ── Health / Root ─────────────────────────────────────────────────────────────

@app.get("/", tags=["System"])
def read_root():
    return {"message": "Welcome to NextDrop API!", "docs": "/docs", "version": "1.0.0"}


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy", "demo_mode": settings.DEMO_MODE}
