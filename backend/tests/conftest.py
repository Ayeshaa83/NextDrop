"""
Test fixtures: in-memory SQLite database + FastAPI TestClient.
No network or cloud DB required.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base_class import Base
import app.models  # noqa: F401 — register all tables on Base.metadata
from app.api import deps
from app.main import app
from app.sec.rate_limiter import limiter
from app.services import email_service

# Tests hammer auth endpoints far past the per-IP limits — disable throttling
limiter.enabled = False

# Never let tests open a real SMTP connection, even if the developer's local
# .env has real Gmail credentials configured — that would make the suite
# slow (or hang) and could actually spam real inboxes.
email_service.send = lambda *args, **kwargs: True

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[deps.get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_client(client):
    """A client signed up and logged in as a fresh artist user."""
    email = "tester@example.com"
    password = "test1234"
    resp = client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    assert resp.status_code in (200, 201), resp.text
    resp = client.post(
        "/api/v1/auth/login/access-token",
        data={"username": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    # Cookie is set on the client automatically; also create an artist profile
    resp = client.post("/api/v1/artists/", json={"stage_name": "Test Artist"})
    assert resp.status_code in (200, 201), resp.text
    client.artist = resp.json()
    return client
