from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker
from app.sec.config import settings 

database_url_obj = make_url(settings.DATABASE_URL)
if settings.DATABASE_HOSTADDR:
    # Override hostname with a direct IP to avoid OS DNS resolver issues.
    # For Neon over IP, include endpoint option and avoid strict channel binding.
    original_host = database_url_obj.host or ""
    endpoint_id = original_host.split(".")[0] if original_host else ""

    database_url_obj = database_url_obj.set(host=settings.DATABASE_HOSTADDR)

    query_updates = {}
    if database_url_obj.query.get("channel_binding", "").lower() == "require":
        query_updates["channel_binding"] = "prefer"
    if endpoint_id and "options" not in database_url_obj.query:
        query_updates["options"] = f"endpoint={endpoint_id}"

    if query_updates:
        database_url_obj = database_url_obj.update_query_dict(query_updates)

database_url = database_url_obj.render_as_string(hide_password=False)

engine = create_engine(
    database_url,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)