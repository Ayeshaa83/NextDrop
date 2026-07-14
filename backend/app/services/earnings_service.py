"""
Earnings Service
================
Derives artist earnings from track analytics using per-platform payout
rates. This is the single source of truth for money math — the wallet,
statements, and the admin payout view all build on it.

Rates (industry approximations, same as revenue prediction):
  - Spotify:  $0.004 / stream
  - YouTube:  $0.001 / view
  - Other:    $0.003 / stream (streams not attributed to a platform)
"""
import datetime
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models import (
    Track, TrackAnalytics, TrackCollaborator,
    Wallet, Payout, PayoutStatus,
)

PLATFORM_RATES = {
    "spotify": 0.004,
    "youtube": 0.001,
    "other": 0.003,
}


@dataclass
class TrackEarnings:
    track_id: int
    title: str
    spotify_streams: int = 0
    youtube_views: int = 0
    other_streams: int = 0
    spotify_revenue: float = 0.0
    youtube_revenue: float = 0.0
    other_revenue: float = 0.0
    gross_revenue: float = 0.0
    royalty_share: float = 100.0   # The artist's split-sheet share (%)
    net_revenue: float = 0.0       # gross * share


@dataclass
class ArtistEarnings:
    tracks: list[TrackEarnings] = field(default_factory=list)
    lifetime_gross: float = 0.0
    lifetime_net: float = 0.0
    platform_totals: dict = field(default_factory=dict)


def _owner_share(db: Session, track_id: int, owner_user_id: int) -> float:
    """The owner's royalty percentage for a track.

    If the split sheet has a row linked to the owner's account, use it;
    otherwise the owner keeps 100% (name-only collaborator rows are
    informational until those people register)."""
    rows = db.query(TrackCollaborator).filter(TrackCollaborator.track_id == track_id).all()
    if not rows:
        return 100.0
    for row in rows:
        if row.user_id == owner_user_id:
            return float(row.royalty_percentage)
    return 100.0


def compute_artist_earnings(db: Session, artist_id: int, owner_user_id: int) -> ArtistEarnings:
    """Compute lifetime earnings for all of an artist's tracks."""
    result = ArtistEarnings()
    rows = (
        db.query(Track, TrackAnalytics)
        .outerjoin(TrackAnalytics, TrackAnalytics.track_id == Track.id)
        .filter(Track.artist_id == artist_id)
        .all()
    )

    sp_total = yt_total = other_total = 0.0

    for track, analytics in rows:
        e = TrackEarnings(track_id=track.id, title=track.title)
        if analytics:
            e.spotify_streams = analytics.spotify_streams or 0
            e.youtube_views = analytics.youtube_views or 0
            e.other_streams = max(
                0, (analytics.stream_count or 0) - e.spotify_streams - e.youtube_views
            )
        e.spotify_revenue = round(e.spotify_streams * PLATFORM_RATES["spotify"], 2)
        e.youtube_revenue = round(e.youtube_views * PLATFORM_RATES["youtube"], 2)
        e.other_revenue = round(e.other_streams * PLATFORM_RATES["other"], 2)
        e.gross_revenue = round(e.spotify_revenue + e.youtube_revenue + e.other_revenue, 2)
        e.royalty_share = _owner_share(db, track.id, owner_user_id)
        e.net_revenue = round(e.gross_revenue * e.royalty_share / 100.0, 2)

        result.tracks.append(e)
        result.lifetime_gross += e.gross_revenue
        result.lifetime_net += e.net_revenue
        sp_total += e.spotify_revenue
        yt_total += e.youtube_revenue
        other_total += e.other_revenue

    result.lifetime_gross = round(result.lifetime_gross, 2)
    result.lifetime_net = round(result.lifetime_net, 2)
    result.platform_totals = {
        "spotify": round(sp_total, 2),
        "youtube": round(yt_total, 2),
        "other": round(other_total, 2),
    }
    return result


def get_withdrawn_total(db: Session, user_id: int) -> float:
    """Money already paid out or on hold (processing counts as reserved)."""
    payouts = db.query(Payout).filter(
        Payout.user_id == user_id,
        Payout.status != PayoutStatus.REJECTED.value,
    ).all()
    return round(sum(p.amount for p in payouts), 2)


def sync_wallet(db: Session, user_id: int, lifetime_net: float) -> Wallet:
    """Recompute the wallet balance (earnings minus withdrawals) and persist it."""
    withdrawn = get_withdrawn_total(db, user_id)
    balance = round(max(0.0, lifetime_net - withdrawn), 2)

    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        wallet = Wallet(user_id=user_id, balance=balance)
        db.add(wallet)
    else:
        wallet.balance = balance
    db.commit()
    db.refresh(wallet)
    return wallet


def create_payout(db: Session, user_id: int, amount: float, method: str) -> Payout:
    """Create a mock withdrawal request (status=processing until admin marks paid)."""
    payout = Payout(
        user_id=user_id,
        amount=round(amount, 2),
        method=method,
        status=PayoutStatus.PROCESSING.value,
        reference=f"NXD-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{user_id}",
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return payout
