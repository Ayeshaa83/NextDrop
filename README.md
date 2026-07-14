# NextDrop

**An artist-first music distribution and analytics platform for independent musicians.**

NextDrop lets independent artists upload, distribute, and track their music from a single dashboard — combining real platform integrations (YouTube, Spotify), AI-assisted metadata and insights, transparent earnings, and an admin-moderated release pipeline, all wrapped in a fast, minimal Next.js interface.

---

## What's Actually Built

Everything below is implemented and working end-to-end, not aspirational.

### For Artists

- **Auth**: email/password signup & login (JWT in an HttpOnly cookie), forgot/reset password via email
- **Onboarding**: new artist profiles require admin approval before they can upload or distribute
- **Upload**: drag-and-drop audio with AI-assisted metadata (genre/BPM/key/mood via a Musicnn tagger + XGBoost hit-score model), cover artwork, ISRC/explicit tags, split-sheet collaborators with royalty percentages, and optional scheduled release dates
- **Distribution**: real YouTube publishing (audio → video via ffmpeg, resumable upload to the artist's connected channel) with territory selection; Spotify connects for listening analytics (direct upload requires a distributor agreement, which is out of scope for an indie platform)
- **Analytics**: streams-over-time, platform breakdown, country-level growth, all backed by a real daily-snapshot pipeline — plus AI-written performance insights, release-timing recommendations, and territory reasoning (via the Claude API, with heuristic fallbacks when no API key is set)
- **Earnings**: a wallet computed from real per-platform stream rates and each artist's split-sheet share, a downloadable CSV statement, and a mock withdrawal flow
- **Community**: Jam Jar (post snippets, like, comment, send collab requests), an Open Verse collaboration marketplace, and a leaderboard with real per-category rankings
- **Notifications**: an in-app notification bell (polls for updates) and email notifications for every approval/rejection/payout/verification event

### For Admins

- A dedicated admin-only panel (separate navigation, no artist menus)
- Track approval queue with audio preview, approve/reject with a reason
- Artist onboarding approval and a verification ("blue tick") badge
- Payout request management (mark paid/rejected)
- Platform-wide growth charts and an approval funnel
- A **platform management panel** — enable/disable any live integration, or add/edit/remove "Coming Soon" platforms — without touching code

### Platform Architecture

New distribution platforms are added by dropping one adapter folder into `backend/app/platforms/` — the integrations hub, the distribution modal, and analytics all auto-discover it. See [`backend/app/platforms/README.md`](backend/app/platforms/README.md).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, TailwindCSS, Framer Motion, Recharts, Zustand |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database | PostgreSQL (Neon serverless) |
| AI / ML | Musicnn audio tagger, XGBoost hit-score model, Claude API (Anthropic) for natural-language insights |
| Platform integrations | Spotify Web API, YouTube Data API v3 (OAuth 2.0) |
| Email | SMTP (Gmail-compatible), HTML templates |
| Auth | JWT, HttpOnly cookies, bcrypt |
| Testing | pytest, in-memory SQLite fixtures |
| Deployment | Docker, Docker Compose |

Full architecture, data flow, and database schema: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- A PostgreSQL database (e.g. a free [Neon](https://neon.tech) project)
- [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) on your PATH (required for YouTube distribution — `winget install --id Gyan.FFmpeg` on Windows)

### 1. Clone the repository

```bash
git clone https://github.com/Ayeshaa83/NextDrop.git
cd NextDrop
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt

cp .env.example .env           # then fill in DATABASE_URL, SECRET_KEY, OAuth credentials, etc.

python -m alembic upgrade head # apply the database schema
python -m app.seed             # optional: populate a 90-day demo dataset (wipes existing data)

uvicorn app.main:app --reload  # http://localhost:8000  (docs at /docs)
```

See `backend/.env.example` for every configuration option — database, JWT secret, Spotify/YouTube OAuth, object storage, the Claude API key, and Gmail SMTP credentials. Every optional integration (AI insights, email) degrades gracefully when unconfigured.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev                    # http://localhost:3000
```

### 4. Demo credentials (after running the seed script)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@nextdrop.ai` | `admin1234` |
| Artist | `axion@nextdrop.ai` | `demo1234` |

*(All five seeded artist accounts — axion, lunasol, kaix, resonance, verablue — use `demo1234`.)*

---

## Running with Docker

```bash
docker compose up --build
```

Spins up PostgreSQL, the backend (with ffmpeg preinstalled), and the frontend together. See [`docker-compose.yml`](docker-compose.yml).

---

## Testing

```bash
cd backend
python -m pytest tests/ -q
```

The suite runs against an isolated in-memory SQLite database and never touches your configured production database or sends real emails.

---

## Project Structure

```
NextDrop/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # FastAPI routers
│   │   ├── crud/               # Database queries
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Earnings, LLM insights, email, notifications
│   │   ├── platforms/          # Pluggable platform adapters (YouTube, Spotify, ...)
│   │   ├── ai_engine/          # Musicnn audio tagging
│   │   └── processing/         # Background audio analysis + hit-score model
│   ├── alembic/versions/       # Database migrations
│   └── tests/                  # pytest suite
├── frontend/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # Shared UI + AI widgets
│   └── lib/                    # Typed API client, hooks, auth context
└── docs/
    └── ARCHITECTURE.md         # System design, data flow, database map
```

---

## License

This project is private. All rights reserved by **Ayesha Shaikh**.
