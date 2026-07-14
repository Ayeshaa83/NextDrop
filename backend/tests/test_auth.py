"""Auth flow: signup, login, me, RBAC gate."""


def test_signup_login_me(client):
    resp = client.post(
        "/api/v1/auth/signup",
        json={"email": "artist@example.com", "password": "secret123"},
    )
    assert resp.status_code in (200, 201), resp.text
    assert resp.json()["email"] == "artist@example.com"

    resp = client.post(
        "/api/v1/auth/login/access-token",
        data={"username": "artist@example.com", "password": "secret123"},
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]

    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == "artist@example.com"
    assert resp.json()["role"] == "user"


def test_wrong_password_rejected(client):
    client.post("/api/v1/auth/signup", json={"email": "a@b.com", "password": "secret123"})
    resp = client.post(
        "/api/v1/auth/login/access-token",
        data={"username": "a@b.com", "password": "wrong"},
    )
    assert resp.status_code in (400, 401)


def test_admin_routes_require_admin_role(auth_client):
    resp = auth_client.get("/api/v1/admin/stats")
    assert resp.status_code == 403
