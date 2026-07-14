"""
Earnings & Payouts Endpoints
============================
Wallet balance, per-track/per-platform earnings, downloadable statements,
and the mock withdrawal flow.
"""
import csv
import io
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.api import deps
from app.crud import artist as artist_crud
from app.models import User, Payout, PayoutStatus
from app.services import earnings_service

router = APIRouter()


# ============ SCHEMAS ============

class TrackEarningsResponse(BaseModel):
    track_id: int
    title: str
    spotify_streams: int
    youtube_views: int
    other_streams: int
    spotify_revenue: float
    youtube_revenue: float
    other_revenue: float
    gross_revenue: float
    royalty_share: float
    net_revenue: float


class EarningsSummaryResponse(BaseModel):
    tracks: list[TrackEarningsResponse]
    lifetime_gross: float
    lifetime_net: float
    platform_totals: dict


class WalletResponse(BaseModel):
    balance: float
    lifetime_earnings: float
    withdrawn: float
    pending_payouts: float


class WithdrawRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: str = Field("bank_transfer", max_length=30)


class PayoutResponse(BaseModel):
    id: int
    amount: float
    method: str
    status: str
    reference: str | None
    created_at: datetime.datetime
    completed_at: datetime.datetime | None

    class Config:
        from_attributes = True


def _get_artist_or_400(db: Session, current_user: User):
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You need to create an artist profile first."
        )
    return artist


# ============ ENDPOINTS ============

@router.get("/summary", response_model=EarningsSummaryResponse)
def earnings_summary(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Per-track, per-platform earnings derived from live analytics."""
    artist = _get_artist_or_400(db, current_user)
    earnings = earnings_service.compute_artist_earnings(db, artist.id, current_user.id)
    return EarningsSummaryResponse(
        tracks=[TrackEarningsResponse(**vars(t)) for t in earnings.tracks],
        lifetime_gross=earnings.lifetime_gross,
        lifetime_net=earnings.lifetime_net,
        platform_totals=earnings.platform_totals,
    )


@router.get("/wallet", response_model=WalletResponse)
def get_wallet(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Current balance = lifetime net earnings minus withdrawals."""
    artist = _get_artist_or_400(db, current_user)
    earnings = earnings_service.compute_artist_earnings(db, artist.id, current_user.id)
    wallet = earnings_service.sync_wallet(db, current_user.id, earnings.lifetime_net)

    pending = sum(
        p.amount for p in db.query(Payout).filter(
            Payout.user_id == current_user.id,
            Payout.status == PayoutStatus.PROCESSING.value,
        ).all()
    )

    return WalletResponse(
        balance=wallet.balance,
        lifetime_earnings=earnings.lifetime_net,
        withdrawn=earnings_service.get_withdrawn_total(db, current_user.id),
        pending_payouts=round(pending, 2),
    )


@router.post("/withdraw", response_model=PayoutResponse)
def request_withdrawal(
    req: WithdrawRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Mock payout: reserves the amount and waits for admin to mark it paid."""
    artist = _get_artist_or_400(db, current_user)
    earnings = earnings_service.compute_artist_earnings(db, artist.id, current_user.id)
    wallet = earnings_service.sync_wallet(db, current_user.id, earnings.lifetime_net)

    if req.amount > wallet.balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. Available: ${wallet.balance:.2f}",
        )

    payout = earnings_service.create_payout(db, current_user.id, req.amount, req.method)
    # Re-sync so the reserved amount is reflected immediately
    earnings_service.sync_wallet(db, current_user.id, earnings.lifetime_net)
    return payout


@router.get("/payouts", response_model=list[PayoutResponse])
def payout_history(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """The user's withdrawal history, newest first."""
    return (
        db.query(Payout)
        .filter(Payout.user_id == current_user.id)
        .order_by(Payout.created_at.desc())
        .all()
    )


@router.get("/statement")
def download_statement(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Downloadable CSV earnings statement (track x platform)."""
    artist = _get_artist_or_400(db, current_user)
    earnings = earnings_service.compute_artist_earnings(db, artist.id, current_user.id)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Track", "Platform", "Units", "Rate (USD)", "Revenue (USD)",
        "Royalty Share (%)", "Net Revenue (USD)",
    ])
    for t in earnings.tracks:
        rows = [
            ("Spotify", t.spotify_streams, earnings_service.PLATFORM_RATES["spotify"], t.spotify_revenue),
            ("YouTube", t.youtube_views, earnings_service.PLATFORM_RATES["youtube"], t.youtube_revenue),
            ("Other", t.other_streams, earnings_service.PLATFORM_RATES["other"], t.other_revenue),
        ]
        for platform, units, rate, revenue in rows:
            if units:
                net = round(revenue * t.royalty_share / 100.0, 2)
                writer.writerow([t.title, platform, units, rate, revenue, t.royalty_share, net])
    writer.writerow([])
    writer.writerow(["TOTAL", "", "", "", earnings.lifetime_gross, "", earnings.lifetime_net])

    buf.seek(0)
    filename = f"nextdrop_statement_{datetime.date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
