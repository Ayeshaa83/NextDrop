# Platform Adapters

Everything platform-specific in NextDrop lives here. The rest of the app
(distribution, integrations hub, analytics refresh, the frontend) never
hardcodes a platform — it all flows from the adapter registry.

## How to add a new platform

**1. Create one folder:**

```
app/platforms/<platform_id>/
├── __init__.py        # from .adapter import my_adapter
└── adapter.py         # implements PlatformInterface + module-level instance
```

**2. Implement the adapter** in `adapter.py`:

```python
from app.platforms.base import PlatformInterface, DistributionResult, PlatformAnalytics


class SoundCloudPlatformAdapter(PlatformInterface):
    # -- identity + display metadata (drives all UI cards automatically) --
    @property
    def platform_id(self) -> str: return "soundcloud"
    @property
    def platform_name(self) -> str: return "SoundCloud"
    @property
    def description(self) -> str: return "Monitor plays and reposts on SoundCloud."
    @property
    def brand_color(self) -> str: return "#FF5500"
    @property
    def category(self) -> str: return "music"   # music | video | social

    # -- capabilities --
    @property
    def supports_distribution(self) -> bool: return True
    @property
    def supports_analytics(self) -> bool: return True

    # -- OAuth --
    def get_auth_url(self, state=None): ...
    async def exchange_code(self, code): ...
    async def refresh_token(self, account): ...

    # -- capabilities implementation --
    async def distribute(self, track, account, options=None) -> DistributionResult: ...
    async def get_track_analytics(self, platform_track_id, account) -> PlatformAnalytics: ...


soundcloud_adapter = SoundCloudPlatformAdapter()   # module-level instance = auto-registered
```

**That's it for the registry.** On startup, `registry.py` scans every
package in this directory, imports its `adapter.py`, and registers any
`PlatformInterface` instance it finds. The platform then automatically
appears in:

- `GET /api/v1/integrations/` → the Integrations hub page
- `GET /api/v1/distribution/platforms` → the Distribute modal
- `POST /api/v1/distribution/` → accepts the new `platform_id`
- `POST /api/v1/analytics/tracks/{id}/refresh-platforms` (if `supports_analytics`)

The frontend renders new platforms with a generic icon tinted in your
`brand_color`; optionally add a dedicated icon by extending the icon maps in
`frontend/components/PlatformCard.tsx` and `frontend/components/DistributionModal.tsx`.

**3. OAuth routes.** If the platform uses the standard flow, expose it:
add `app/api/v1/endpoints/<platform_id>_auth.py` with `/login`, `/callback`,
`/status`, `/refresh`, `/disconnect` routes (copy `spotify_auth.py` as a
template) and register the router in `app/main.py` under
`/api/v1/<platform_id>`. The default `login_endpoint`/`disconnect_endpoint`
properties on the interface already point there.

**4. Secrets** go in `.env` (see `.env.example`) and `app/sec/config.py`.

## Placeholders ("Coming Soon")

Platforms we plan to support but haven't built are listed in
`app/api/v1/endpoints/integrations.py` → `COMING_SOON`. A placeholder is
dropped automatically as soon as a real adapter with the same id registers.
