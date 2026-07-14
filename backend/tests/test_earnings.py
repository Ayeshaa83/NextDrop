"""Earnings: rate math, wallet balance, mock withdrawal flow."""
from app.models import Track, TrackAnalytics


def _seed_track_with_streams(db, artist_id: int, spotify=10_000, youtube=20_000, other=5_000):
    track = Track(
        artist_id=artist_id,
        title="Money Maker",
        duration=200,
        file_url="http://localhost:8000/api/v1/storage/local/tracks/1/x.mp3",
        is_public=True,
    )
    db.add(track)
    db.flush()
    db.add(TrackAnalytics(
        track_id=track.id,
        stream_count=spotify + youtube + other,
        spotify_streams=spotify,
        youtube_views=youtube,
    ))
    db.commit()
    return track


def test_earnings_summary_math(auth_client, db):
    artist_id = auth_client.artist["id"]
    _seed_track_with_streams(db, artist_id)

    resp = auth_client.get("/api/v1/earnings/summary")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    row = data["tracks"][0]
    assert row["spotify_revenue"] == round(10_000 * 0.004, 2)   # $40.00
    assert row["youtube_revenue"] == round(20_000 * 0.001, 2)   # $20.00
    assert row["other_revenue"] == round(5_000 * 0.003, 2)      # $15.00
    assert row["gross_revenue"] == 75.0
    assert row["royalty_share"] == 100.0
    assert data["lifetime_net"] == 75.0


def test_wallet_and_withdrawal_flow(auth_client, db):
    artist_id = auth_client.artist["id"]
    _seed_track_with_streams(db, artist_id)

    resp = auth_client.get("/api/v1/earnings/wallet")
    assert resp.status_code == 200
    assert resp.json()["balance"] == 75.0

    # Withdraw more than the balance → rejected
    resp = auth_client.post("/api/v1/earnings/withdraw", json={"amount": 100.0})
    assert resp.status_code == 400

    # Valid withdrawal reserves the amount
    resp = auth_client.post("/api/v1/earnings/withdraw", json={"amount": 50.0})
    assert resp.status_code == 200
    assert resp.json()["status"] == "processing"

    resp = auth_client.get("/api/v1/earnings/wallet")
    wallet = resp.json()
    assert wallet["balance"] == 25.0
    assert wallet["pending_payouts"] == 50.0

    resp = auth_client.get("/api/v1/earnings/payouts")
    assert len(resp.json()) == 1
