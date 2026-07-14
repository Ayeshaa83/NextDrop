"""Platform adapter registry: discovery, capabilities, pluggability."""
from typing import Any, Optional

from app.platforms.base import PlatformInterface
from app.platforms.registry import PlatformRegistry, registry
from app.api.v1.endpoints.integrations import build_platform_list


def test_builtin_adapters_discovered():
    ids = {a.platform_id for a in registry.get_all_adapters()}
    assert {"spotify", "youtube"} <= ids


def test_capability_filters():
    dist_ids = {a.platform_id for a in registry.get_distribution_adapters()}
    assert "youtube" in dist_ids
    assert "spotify" not in dist_ids  # Spotify has no direct-upload API

    analytics_ids = {a.platform_id for a in registry.get_analytics_adapters()}
    assert {"spotify", "youtube"} <= analytics_ids


def test_integrations_list_derived_from_registry():
    platforms = {p["id"]: p for p in build_platform_list()}
    assert platforms["youtube"]["available"] is True
    assert platforms["youtube"]["supports_distribution"] is True
    assert platforms["spotify"]["available"] is True
    # Coming-soon placeholders stay display-only
    assert platforms["apple_music"]["available"] is False
    assert platforms["apple_music"]["login_endpoint"] is None


class _StubAdapter(PlatformInterface):
    @property
    def platform_id(self) -> str:
        return "stubcloud"

    @property
    def platform_name(self) -> str:
        return "StubCloud"

    @property
    def supports_distribution(self) -> bool:
        return True

    def get_auth_url(self, state: Optional[str] = None) -> str:
        return "https://example.com/auth"

    async def exchange_code(self, code: str) -> dict[str, Any]:
        return {}

    async def refresh_token(self, account) -> dict[str, Any]:
        return {}


def test_new_adapter_registers_with_defaults():
    """A new platform needs only an adapter — metadata defaults derive from id."""
    reg = PlatformRegistry()
    reg.register(_StubAdapter())

    adapter = reg.get_adapter("stubcloud")
    assert adapter is not None
    assert adapter.login_endpoint == "/api/v1/stubcloud/login"
    assert adapter.disconnect_endpoint == "/api/v1/stubcloud/disconnect"
    assert "stubcloud" in {a.platform_id for a in reg.get_distribution_adapters()}
