"""
Platform Registry
=================
Central registry for all platform adapters. The rest of the application
(e.g., the integrations endpoints or the distribution task) asks the
registry for an adapter by its ID (e.g., 'youtube', 'spotify').

Adapters are AUTO-DISCOVERED: every package under `app/platforms/<name>/`
that contains an `adapter.py` module is imported at startup, and any
`PlatformInterface` instance defined in it is registered automatically.
Adding a new platform therefore requires no changes to this file —
see app/platforms/README.md.
"""
import importlib
import logging
import pkgutil
from pathlib import Path
from typing import Optional, Dict

from app.platforms.base import PlatformInterface

logger = logging.getLogger(__name__)

# Sub-packages of app/platforms that are not platform adapters
_NON_PLATFORM_PACKAGES = {"base"}


class PlatformRegistry:
    """Registry to manage and retrieve platform adapters."""

    def __init__(self):
        self._adapters: Dict[str, PlatformInterface] = {}
        self._discover_adapters()

    def _discover_adapters(self) -> None:
        """Import every app/platforms/<pkg>/adapter.py and register the
        PlatformInterface instances it defines."""
        platforms_dir = Path(__file__).parent
        for module_info in pkgutil.iter_modules([str(platforms_dir)]):
            if not module_info.ispkg or module_info.name in _NON_PLATFORM_PACKAGES:
                continue
            module_path = f"app.platforms.{module_info.name}.adapter"
            try:
                module = importlib.import_module(module_path)
            except ModuleNotFoundError:
                logger.warning("Platform package '%s' has no adapter.py — skipped", module_info.name)
                continue
            except Exception:
                logger.exception("Failed to import platform adapter '%s'", module_path)
                continue

            found = False
            for attr in vars(module).values():
                if isinstance(attr, PlatformInterface):
                    self.register(attr)
                    found = True
            if not found:
                logger.warning("No PlatformInterface instance found in %s", module_path)

    def register(self, adapter: PlatformInterface) -> None:
        """Register a new platform adapter."""
        if not isinstance(adapter, PlatformInterface):
            raise TypeError(f"Adapter {adapter} must implement PlatformInterface")
        self._adapters[adapter.platform_id] = adapter
        logger.info("Registered platform adapter: %s", adapter.platform_id)

    def get_adapter(self, platform_id: str) -> Optional[PlatformInterface]:
        """Retrieve an adapter by its ID. Returns None if not found."""
        return self._adapters.get(platform_id)

    def get_all_adapters(self) -> list[PlatformInterface]:
        """Return a list of all registered platform adapters."""
        return list(self._adapters.values())

    def get_distribution_adapters(self) -> list[PlatformInterface]:
        """Return all adapters that support track distribution."""
        return [a for a in self._adapters.values() if a.supports_distribution]

    def get_analytics_adapters(self) -> list[PlatformInterface]:
        """Return all adapters that support track analytics."""
        return [a for a in self._adapters.values() if a.supports_analytics]


# ── Singleton Registry ────────────────────────────────────────────────────────
registry = PlatformRegistry()
