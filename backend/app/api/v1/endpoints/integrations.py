"""
Integrations Router — Platform Connection Hub
====================================================
Central hub for all third-party platform connections.

The list of AVAILABLE platforms is derived from the platform adapter
registry (app/platforms/registry.py) — the single source of truth.
Adding a new platform = adding one adapter package under app/platforms/
(see app/platforms/README.md); it appears here automatically.

COMING_SOON below is only a display list of platforms we plan to support;
entries are removed automatically once a real adapter with the same id
is registered.
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.models import User, SocialAccount
from app.platforms.registry import registry

router = APIRouter()


# ============ COMING SOON PLACEHOLDERS ============
# Display-only. No OAuth flow exists for these yet. To make one real,
# create app/platforms/<id>/adapter.py — it will replace the placeholder.

COMING_SOON = [
    {
        "id": "apple_music",
        "name": "Apple Music",
        "description": "Connect Apple Music for streaming analytics.",
        "color": "#FC3C44",
        "category": "music",
    },
    {
        "id": "tiktok",
        "name": "TikTok",
        "description": "Track viral performance and short-form reach.",
        "color": "#69C9D0",
        "category": "social",
    },
    {
        "id": "soundcloud",
        "name": "SoundCloud",
        "description": "Monitor plays and reposts on SoundCloud.",
        "color": "#FF5500",
        "category": "music",
    },
    {
        "id": "instagram",
        "name": "Instagram",
        "description": "Measure reel reach and story engagement.",
        "color": "#E1306C",
        "category": "social",
    },
    {
        "id": "twitch",
        "name": "Twitch",
        "description": "Live stream metrics and viewer analytics.",
        "color": "#9146FF",
        "category": "video",
    },
    {
        "id": "twitter",
        "name": "X / Twitter",
        "description": "Track mentions, engagement, and follower growth.",
        "color": "#1DA1F2",
        "category": "social",
    },
]


# ============ SCHEMAS ============

class PlatformStatus(BaseModel):
    id: str
    name: str
    description: str
    color: str
    category: str
    available: bool
    connected: bool
    login_endpoint: str | None
    disconnect_endpoint: str | None
    supports_distribution: bool = False
    supports_analytics: bool = False
    # Connected account info (if linked)
    display_name: str | None = None
    profile_image_url: str | None = None
    expires_at: datetime | None = None
    token_expired: bool = False


class IntegrationsOverview(BaseModel):
    platforms: list[PlatformStatus]
    connected_count: int
    total_available: int


def build_platform_list(db: Session | None = None) -> list[dict]:
    """Merge real adapters (from the registry) with placeholder platforms.

    When a DB session is provided, admin-managed `platform_configs` rows are
    the source for placeholders and can override adapter display info or
    disable a platform entirely. Without a DB (unit tests), the static
    COMING_SOON list is used.
    """
    configs: dict[str, "object"] = {}
    if db is not None:
        from app.models import PlatformConfig
        configs = {c.platform_id: c for c in db.query(PlatformConfig).all()}

    platforms = []
    registered_ids = set()

    for adapter in registry.get_all_adapters():
        registered_ids.add(adapter.platform_id)
        cfg = configs.get(adapter.platform_id)
        enabled = cfg.enabled if cfg else True
        platforms.append({
            "id": adapter.platform_id,
            "name": cfg.display_name if cfg else adapter.platform_name,
            "description": cfg.description if cfg else adapter.description,
            "color": cfg.color if cfg else adapter.brand_color,
            "category": cfg.category if cfg else adapter.category,
            "available": enabled,
            "login_endpoint": adapter.login_endpoint if enabled else None,
            "disconnect_endpoint": adapter.disconnect_endpoint if enabled else None,
            "supports_distribution": adapter.supports_distribution and enabled,
            "supports_analytics": adapter.supports_analytics and enabled,
        })

    if db is not None:
        placeholders = [
            {
                "id": c.platform_id, "name": c.display_name,
                "description": c.description, "color": c.color, "category": c.category,
            }
            for c in configs.values()
            if c.platform_id not in registered_ids and c.enabled
        ]
    else:
        placeholders = COMING_SOON

    for placeholder in placeholders:
        if placeholder["id"] in registered_ids:
            continue  # a real adapter now exists — drop the placeholder
        platforms.append({
            **placeholder,
            "available": False,
            "login_endpoint": None,
            "disconnect_endpoint": None,
            "supports_distribution": False,
            "supports_analytics": False,
        })

    return platforms


# ============ ENDPOINTS ============

@router.get("/", response_model=IntegrationsOverview)
def list_integrations(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Returns the full platform registry with live connection status
    for the current user. The frontend uses this to render all
    platform cards in one request.
    """
    # Fetch all of the user's connected accounts in one query
    connected_accounts = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id
    ).all()

    # Build a lookup map: provider_id -> SocialAccount
    account_map = {acc.provider: acc for acc in connected_accounts}

    platforms: list[PlatformStatus] = []
    connected_count = 0
    total_available = 0

    for platform in build_platform_list(db):
        pid = platform["id"]
        account = account_map.get(pid)
        is_connected = account is not None
        token_expired = False

        if is_connected:
            connected_count += 1
            if account.expires_at and account.expires_at < datetime.utcnow():
                token_expired = True

        if platform["available"]:
            total_available += 1

        platforms.append(PlatformStatus(
            **platform,
            connected=is_connected,
            display_name=account.display_name if account else None,
            profile_image_url=account.profile_image_url if account else None,
            expires_at=account.expires_at if account else None,
            token_expired=token_expired,
        ))

    return IntegrationsOverview(
        platforms=platforms,
        connected_count=connected_count,
        total_available=total_available,
    )


@router.get("/summary")
def integrations_summary(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Lightweight summary — just connected platform IDs.
    Useful for quick status checks in headers/dashboards.
    """
    connected = db.query(SocialAccount.provider).filter(
        SocialAccount.user_id == current_user.id
    ).all()

    return {
        "connected": [row.provider for row in connected],
        "count": len(connected),
    }
