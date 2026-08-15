"""
Hourly background refresh for platform analytics.

Without this, every number on the dashboard, leaderboard, and analytics
charts only updates when someone happens to have a track's page open (and
even then, only past a 15-minute staleness threshold) or clicks "Refresh
Analytics" by hand — the numbers can sit stale indefinitely otherwise.

APScheduler runs this in-process (no Celery/Redis broker needed for a job
this small) — one job, one interval, started alongside the FastAPI app and
stopped cleanly on shutdown.
"""
import datetime
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.db.session import SessionLocal
from app.services.analytics_refresh import refresh_all_live_analytics

logger = logging.getLogger(__name__)

REFRESH_INTERVAL_HOURS = 1

# Built fresh in start_scheduler() rather than at import time — a single
# AsyncIOScheduler instance binds to whichever asyncio event loop is running
# when it starts. The test suite spins up a new event loop per test (each
# `with TestClient(app)` runs the full lifespan), so reusing one instance
# across all of them broke with "Event loop is closed" on the second test.
# A fresh instance per lifespan cycle avoids that entirely.
_scheduler: AsyncIOScheduler | None = None


async def _run_scheduled_refresh() -> None:
    db = SessionLocal()
    try:
        result = await refresh_all_live_analytics(db)
        logger.info("Scheduled analytics refresh: %s", result)
    except Exception:
        logger.exception("Scheduled analytics refresh crashed")
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _run_scheduled_refresh,
        trigger=IntervalTrigger(hours=REFRESH_INTERVAL_HOURS),
        id="analytics_refresh",
        replace_existing=True,
        # Also fire once right away, rather than only after the first full
        # hour — otherwise a freshly (re)started server shows stale numbers
        # for up to an hour before the job ever runs for the first time.
        next_run_time=datetime.datetime.now(),
    )
    _scheduler.start()
    logger.info("Analytics refresh scheduler started (every %sh)", REFRESH_INTERVAL_HOURS)


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Analytics refresh scheduler stopped")
    _scheduler = None
