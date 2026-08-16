"""
Shared platform-analytics refresh logic, used by the manual "Refresh
Analytics" endpoint (and the on-page-visit staleness check that calls the
same endpoint from the frontend).

Deliberately no bulk/scheduled "refresh everything" job here — YouTube's
Data API v3 enforces a daily quota (commonly 10,000 units/day; videos.list
costs 1 unit/call), so refreshing every live video on a fixed interval
would scale with the catalog size and eventually blow through it. Manual
refresh is quota-safe because it's bounded by how many artists are actually
looking, not by total video count.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.crud import analytics as analytics_crud
from app.models import TrackDistribution, DistributionStatus, TrackAnalytics
from app.platforms.registry import registry
from app.services.platform_accounts import get_ready_account

logger = logging.getLogger(__name__)


async def refresh_track_analytics(db: Session, track_id: int, user_id: int) -> TrackAnalytics:
    """
    Fetch real analytics from every platform a track is currently live on,
    for the given user's connected accounts, and persist the results.

    Best-effort per platform — one platform failing (expired connection,
    API hiccup) doesn't stop the others from updating.
    """
    distributions = db.query(TrackDistribution).filter(
        TrackDistribution.track_id == track_id,
        TrackDistribution.status == DistributionStatus.LIVE.value,
    ).all()

    analytics = analytics_crud.get_analytics_by_track_id(db, track_id=track_id)
    if not analytics:
        analytics = analytics_crud.create_or_update_analytics(db, track_id=track_id)

    for dist in distributions:
        adapter = registry.get_adapter(dist.platform)
        if not adapter or not adapter.supports_analytics:
            continue

        try:
            account = await get_ready_account(db, user_id, adapter)
            if not account:
                continue

            stats = await adapter.get_track_analytics(dist.platform_track_id, account)

            if dist.platform == "youtube":
                analytics.youtube_views = stats.views or 0
                analytics.youtube_likes = stats.likes or 0
                analytics.youtube_comments = stats.comments or 0
                # Record the daily delta for the streams-over-time chart
                analytics_crud.record_snapshot(
                    db, track_id, "youtube", analytics.youtube_views, commit=False
                )

            elif dist.platform == "spotify":
                # streams/saves are always None via the public Web API (no
                # distributor partnership) — popularity (0-100) is the one
                # real per-track metric it actually exposes.
                analytics.spotify_streams = stats.streams or 0
                analytics.spotify_saves = stats.saves or 0
                analytics.spotify_popularity = stats.raw.get("popularity")
                analytics_crud.record_snapshot(
                    db, track_id, "spotify", analytics.spotify_streams, commit=False
                )

            # Update total aggregates
            analytics.stream_count = (analytics.youtube_views or 0) + (analytics.spotify_streams or 0)
            analytics.save_count = (analytics.youtube_likes or 0) + (analytics.spotify_saves or 0)

            # A successful check should always read as "just checked", even
            # when the platform reports the same numbers as last time — the
            # onupdate on last_updated only fires when a column actually
            # changes, which otherwise left this looking falsely stale.
            analytics.last_updated = datetime.now(timezone.utc)

        except Exception:
            # Skip this platform if stats fail, move to next
            logger.warning("Analytics refresh failed for track %s on %s", track_id, dist.platform, exc_info=True)
            continue

    db.commit()
    db.refresh(analytics)
    return analytics
