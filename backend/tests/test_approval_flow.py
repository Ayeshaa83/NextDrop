"""Artist onboarding approval: upload/distribution gates + admin queue."""
from app.models import User, UserRole
from app.sec.security import get_password_hash


TRACK_PAYLOAD = {
    "title": "Gate Test",
    "duration": 180,
    "file_url": "http://localhost:8000/api/v1/storage/local/tracks/1/x.mp3",
    "is_public": False,
}


def _make_admin(db, client):
    """Create (once) and log in as the admin. Safe to call multiple times
    per test — later calls just re-authenticate as the existing admin."""
    admin = db.query(User).filter(User.email == "admin@example.com").first()
    if not admin:
        admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("admin1234"),
            is_active=True,
            role=UserRole.ADMIN.value,
        )
        db.add(admin)
        db.commit()
    resp = client.post(
        "/api/v1/auth/login/access-token",
        data={"username": "admin@example.com", "password": "admin1234"},
    )
    assert resp.status_code == 200


def test_new_artist_is_pending_and_blocked_from_upload(auth_client):
    assert auth_client.artist["approval_status"] == "pending"

    resp = auth_client.post("/api/v1/tracks/", json=TRACK_PAYLOAD)
    assert resp.status_code == 403
    assert "approval" in resp.json()["detail"].lower()


def test_admin_approval_unlocks_upload(auth_client, db):
    artist_id = auth_client.artist["id"]
    artist_cookies = dict(auth_client.cookies)

    # Admin approves the artist (this replaces the client's login cookie)
    _make_admin(db, auth_client)
    resp = auth_client.put(f"/api/v1/admin/artists/{artist_id}/approval?approval=approved")
    assert resp.status_code == 200
    assert resp.json()["approval_status"] == "approved"

    # Back as the artist: upload now works
    auth_client.cookies.clear()
    auth_client.cookies.update(artist_cookies)
    resp = auth_client.post("/api/v1/tracks/", json=TRACK_PAYLOAD)
    assert resp.status_code == 201, resp.text

    # But distribution stays blocked until the TRACK is approved too
    track_id = resp.json()["id"]
    resp = auth_client.post(
        "/api/v1/distribution/",
        json={"track_id": track_id, "platform_id": "youtube"},
    )
    assert resp.status_code == 403
    assert "approved" in resp.json()["detail"].lower()


def test_rejected_artist_blocked(auth_client, db):
    artist_id = auth_client.artist["id"]
    artist_cookies = dict(auth_client.cookies)

    _make_admin(db, auth_client)
    resp = auth_client.put(f"/api/v1/admin/artists/{artist_id}/approval?approval=rejected")
    assert resp.status_code == 200

    auth_client.cookies.clear()
    auth_client.cookies.update(artist_cookies)
    resp = auth_client.post("/api/v1/tracks/", json=TRACK_PAYLOAD)
    assert resp.status_code == 403


def test_platform_config_crud(auth_client, db):
    _make_admin(db, auth_client)

    # Listing auto-creates config rows for code adapters
    resp = auth_client.get("/api/v1/admin/platforms")
    assert resp.status_code == 200
    by_id = {p["platform_id"]: p for p in resp.json()}
    assert by_id["youtube"]["has_adapter"] is True

    # Add a Coming Soon platform
    resp = auth_client.post("/api/v1/admin/platforms", json={
        "platform_id": "deezer", "display_name": "Deezer",
        "description": "Streaming analytics", "color": "#a238ff", "category": "music",
    })
    assert resp.status_code == 201
    cfg = resp.json()
    assert cfg["has_adapter"] is False

    # Disable YouTube platform-wide → distribution platform list drops it
    yt = by_id["youtube"]
    resp = auth_client.put(f"/api/v1/admin/platforms/{yt['id']}", json={
        **{k: yt[k] for k in ("platform_id", "display_name", "description", "color", "category")},
        "enabled": False,
    })
    assert resp.status_code == 200

    resp = auth_client.get("/api/v1/distribution/platforms")
    assert resp.status_code == 200
    assert "youtube" not in {p["id"] for p in resp.json()}

    # A live platform can't be deleted, only disabled
    resp = auth_client.delete(f"/api/v1/admin/platforms/{yt['id']}")
    assert resp.status_code == 400

    # A placeholder can be deleted
    resp = auth_client.delete(f"/api/v1/admin/platforms/{cfg['id']}")
    assert resp.status_code == 204


def test_forgot_password_never_leaks_accounts(client):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "ghost@example.com"})
    assert resp.status_code == 200
    assert "reset link" in resp.json()["message"]


def test_password_reset_roundtrip(auth_client, db):
    from app.sec.security import create_password_reset_token

    me = auth_client.get("/api/v1/auth/me").json()
    token = create_password_reset_token(me["id"])

    resp = auth_client.post("/api/v1/auth/reset-password", json={
        "token": token, "new_password": "brandnew123",
    })
    assert resp.status_code == 200

    # Old password no longer works, new one does
    resp = auth_client.post(
        "/api/v1/auth/login/access-token",
        data={"username": "tester@example.com", "password": "test1234"},
    )
    assert resp.status_code in (400, 401)
    resp = auth_client.post(
        "/api/v1/auth/login/access-token",
        data={"username": "tester@example.com", "password": "brandnew123"},
    )
    assert resp.status_code == 200

    # Garbage token is rejected
    resp = auth_client.post("/api/v1/auth/reset-password", json={
        "token": "garbage", "new_password": "whatever123",
    })
    assert resp.status_code == 400


def test_notifications_created_on_track_and_artist_decisions(auth_client, db):
    from app.models import Notification

    artist_id = auth_client.artist["id"]
    artist_cookies = dict(auth_client.cookies)

    _make_admin(db, auth_client)

    # Approve the artist -> artist gets a notification
    resp = auth_client.put(f"/api/v1/admin/artists/{artist_id}/approval?approval=approved")
    assert resp.status_code == 200

    me = db.query(Notification).filter(Notification.type == "artist_approved").first()
    assert me is not None
    assert me.link == "/upload"

    # Upload + approve a track -> another notification, with a link
    auth_client.cookies.clear()
    auth_client.cookies.update(artist_cookies)
    resp = auth_client.post("/api/v1/tracks/", json=TRACK_PAYLOAD)
    assert resp.status_code == 201
    track_id = resp.json()["id"]

    auth_client.cookies.clear()
    _make_admin(db, auth_client)
    resp = auth_client.put(
        f"/api/v1/admin/tracks/{track_id}/approve",
        json={"status": "rejected", "notes": "Needs a cleaner master"},
    )
    assert resp.status_code == 200

    track_notif = db.query(Notification).filter(Notification.type == "track_rejected").first()
    assert track_notif is not None
    assert "cleaner master" in track_notif.body

    # Back as the artist: unread count + list + mark-read all work
    auth_client.cookies.clear()
    auth_client.cookies.update(artist_cookies)
    resp = auth_client.get("/api/v1/notifications/unread-count")
    assert resp.status_code == 200
    assert resp.json()["unread_count"] >= 2

    resp = auth_client.get("/api/v1/notifications/")
    assert resp.status_code == 200
    notif_id = resp.json()["items"][0]["id"]

    resp = auth_client.put(f"/api/v1/notifications/{notif_id}/read")
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True

    resp = auth_client.put("/api/v1/notifications/read-all")
    assert resp.status_code == 200

    resp = auth_client.get("/api/v1/notifications/unread-count")
    assert resp.json()["unread_count"] == 0
