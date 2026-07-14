# NextDrop — Architecture & Flow Documentation

Artist-first music distribution & analytics platform.
Stack: **Next.js (App Router) · FastAPI · PostgreSQL · Claude API · Spotify/YouTube OAuth**

---

## 1. System Overview

```
┌────────────────────────┐        ┌──────────────────────────────────────────┐
│  Next.js Frontend      │  HTTP  │  FastAPI Backend (app/)                  │
│  (React, Recharts,     │◄──────►│                                          │
│   Zustand, Tailwind)   │ cookie │  api/v1/endpoints/   ── routers          │
│                        │  JWT   │  crud/               ── DB queries       │
│  lib/api.ts            │        │  services/           ── earnings, LLM    │
│  (typed API layer)     │        │  platforms/          ── adapter registry │
└────────────────────────┘        │  processing/, ai_engine/ ── ML analysis  │
                                  └───────┬──────────────────────┬───────────┘
                                          │                      │
                              ┌───────────▼──────────┐   ┌───────▼───────────────┐
                              │ PostgreSQL (Neon /   │   │ External services     │
                              │ compose Postgres)    │   │ · Spotify Web API     │
                              │ via SQLAlchemy 2 +   │   │ · YouTube Data API v3 │
                              │ Alembic migrations   │   │ · Claude API (LLM)    │
                              └──────────────────────┘   │ · S3/R2 or local disk │
                                                         └───────────────────────┘
```

**Auth:** JWT in an HttpOnly cookie (plus Bearer fallback). RBAC roles: `user`, `artist`, `admin`
(`app/api/deps.py` → `get_current_active_user`, `get_current_artist`, `get_current_admin`).

---

## 2. Platform Adapter Registry (distribution & integrations)

The core design principle: **adding a platform touches one folder.**

```
app/platforms/
├── base/platform_interface.py   ← abstract interface + display metadata
├── registry.py                  ← AUTO-DISCOVERS app/platforms/*/adapter.py
├── spotify/adapter.py           ← OAuth + listener analytics (no direct upload)
└── youtube/adapter.py           ← OAuth + REAL distribution (ffmpeg → upload) + stats
```

Each adapter declares identity (`platform_id`, `platform_name`), display metadata
(`description`, `brand_color`, `category`), capabilities (`supports_distribution`,
`supports_analytics`), and implements OAuth (`get_auth_url`, `exchange_code`,
`refresh_token`) plus optional `distribute()` / `get_track_analytics()`.

Everything downstream derives from the registry:

| Consumer | Endpoint |
|---|---|
| Integrations hub page | `GET /api/v1/integrations/` |
| Distribution modal | `GET /api/v1/distribution/platforms` |
| Distribution engine | `POST /api/v1/distribution/` |
| Analytics refresh | `POST /api/v1/analytics/tracks/{id}/refresh-platforms` |

See `backend/app/platforms/README.md` for the add-a-platform guide.

### Distribution flow

```
Artist clicks "Distribute" (DistributionModal, optional territory selection)
  → POST /api/v1/distribution/  {track_id, platform_id, territories}
      1. Ownership check (user → artist profile → track)
      2. registry.get_adapter(platform_id), supports_distribution check
      3. OAuth token loaded from social_accounts, refreshed + decrypted (Fernet)
      4. adapter.distribute(track, account)   e.g. YouTube: download audio,
         ffmpeg → MP4, resumable upload to YouTube Data API
      5. Result stored in track_distributions (status: pending/live/failed,
         platform_track_id, platform_url, territories)
```

---

## 3. Analytics Pipeline

```
                       real path                           demo path
  YouTube/Spotify APIs ──► refresh-platforms ─┐      simulate / seed script ─┐
                                              ▼                              ▼
                                   track_analytics (aggregates)   analytics_snapshots
                                   spotify_streams, youtube_views (daily deltas per
                                   stream_count, hit_score, ...    platform + country)
                                              │                              │
        ┌─────────────────────────────────────┴──────────────┬───────────────┘
        ▼                                                    ▼
  GET /analytics/dashboard                     GET /analytics/timeseries (chart)
  GET /analytics/revenue (prediction)          GET /analytics/territories (geo)
```

- `analytics_snapshots` stores **daily stream deltas** per track/platform/country —
  this powers streams-over-time, territory breakdowns, and release-timing analysis.
- `record_snapshot()` (crud/analytics.py) converts cumulative platform counters into
  daily deltas on every refresh.
- The ML hit score comes from the XGBoost model (`ml_models/`) run at upload time;
  Musicnn (`ai_engine/`) provides genre/mood/instrument tags.

---

## 4. Earnings & Payouts (simulated money, real math)

Single source of truth: `app/services/earnings_service.py`.

```
rates: Spotify $0.004/stream · YouTube $0.001/view · Other $0.003/stream

track_analytics ──► compute_artist_earnings() ──► per-track gross revenue
track_collaborators (split sheets) ──► owner's royalty share ──► net revenue
net lifetime earnings − payouts ──► wallets.balance (synced on read)

POST /earnings/withdraw ──► payouts (status=processing)
Admin marks paid/rejected ──► PUT /admin/payouts/{id}/status
GET /earnings/statement  ──► downloadable CSV
```

---

## 5. AI Layer

Two tiers, both with graceful degradation:

1. **Real ML (local):** Musicnn auto-tagger + XGBoost hit-prediction, run as a
   background task after upload (`processing/tasks.py`). Requires librosa/numpy.
2. **LLM insights (Claude API):** `app/services/llm_insights.py` wraps
   `claude-sonnet-5` (configurable via `INSIGHTS_MODEL`) with JSON-schema
   constrained outputs. Used by `/api/ai/*`:

| Endpoint | Data source | LLM role | Fallback |
|---|---|---|---|
| `/api/ai/performance-insight` | metric deltas | writes headline/body/tip | rule-based copy |
| `/api/ai/territory-growth` | analytics_snapshots by country | per-territory reasoning | demo list |
| `/api/ai/release-timing` | day-of-week stream history | justification | Friday 6 PM default |
| `/api/ai/suggest-metadata` | track + ML analysis | metadata quality review | seeded heuristic |
| `/api/ai/trends` | platform-wide genre aggregates | style/platform recommendation | top-growth genre |

No `ANTHROPIC_API_KEY` → everything still works on heuristics.

---

## 6. Key User Flows

**Artist:** signup → artist profile → upload (real file to storage, artwork,
ISRC/explicit, split sheet, optional scheduled release date) → admin approval →
distribute (platform + territories) → analytics dashboard → AI insights →
earnings → mock withdrawal.

**Admin:** login (role=admin) → `/admin`: platform growth charts, approval queue
(with audio preview), artist verification badges, payout requests.

**Community:** Jam Jar feed (snippets / open verses / posts, likes, comments,
collab requests) → Open Verse marketplace (join a verse, accept incoming
requests) → leaderboard (category filters, real personal rank).

---

## 7. Database Map (main tables)

| Table | Purpose |
|---|---|
| users / artists / wallets / payouts | identity, RBAC, verification, mock money |
| tracks / albums / album_tracks | catalog; release_date, isrc, cover_art_url |
| track_collaborators | split sheets (royalty %) |
| track_distributions | per-platform release state + territories |
| track_analytics | lifetime aggregates per track |
| analytics_snapshots | daily deltas per platform/country (time series) |
| revenue_predictions | monthly revenue estimate |
| social_accounts | encrypted OAuth tokens per platform |
| social_posts / comments / post_likes / collaborations | community |
| leaderboard | ranked artists per category |

Migrations: `backend/alembic/versions/` (`python -m alembic upgrade head`).

---

## 8. Running It

```bash
# Local dev
cd backend && uvicorn app.main:app --reload          # api on :8000
cd frontend && npm run dev                           # ui on :3000

# Demo dataset (wipes DB!)
cd backend && python -m app.seed

# Full stack via Docker
docker compose up --build
```

Environment: `backend/.env` (see `.env.example`) — DB URL, JWT secret,
Spotify/Google OAuth credentials, optional S3 storage and `ANTHROPIC_API_KEY`.
