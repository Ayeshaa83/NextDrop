"""
Shared helper for getting a ready-to-use connected platform account.

Same refresh-if-expired + decrypt sequence distribution.py already does
inline before calling adapter.distribute(); factored out here so the
unpublish/delete endpoints (which need the identical prep before calling
adapter.unpublish()/delete_content()) don't duplicate it a second and
third time.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import SocialAccount
from app.platforms.base.platform_interface import PlatformInterface
from app.sec.encryption import decrypt_token


async def get_ready_account(
    db: Session, user_id: int, adapter: PlatformInterface
) -> SocialAccount | None:
    """The user's connected account for this platform, with a fresh
    (refreshed if expired) and decrypted access token ready to use —
    or None if they haven't connected it."""
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == user_id,
        SocialAccount.provider == adapter.platform_id,
    ).first()
    if not account:
        return None

    if account.expires_at and account.expires_at < datetime.utcnow():
        new_tokens = await adapter.refresh_token(account)
        for k, v in new_tokens.items():
            if hasattr(account, k) and v is not None:
                setattr(account, k, v)
        account.updated_at = datetime.utcnow()
        db.commit()

    account.access_token = decrypt_token(account.access_token)
    if account.refresh_token:
        account.refresh_token = decrypt_token(account.refresh_token)
    return account
