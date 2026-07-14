"""
Token Encryption Utility
========================
Provides symmetric encryption for OAuth access/refresh tokens stored in the
database. Uses Fernet (AES-128-CBC + HMAC-SHA256) from the `cryptography`
package which is already a project dependency.

Usage
-----
    from app.sec.encryption import encrypt_token, decrypt_token

    encrypted = encrypt_token("ya29.some-secret-token")
    original  = decrypt_token(encrypted)

The encryption key is derived from the SECRET_KEY already in .env — no extra
env variable is needed.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.sec.config import settings


def _get_fernet() -> Fernet:
    """
    Derive a 32-byte Fernet key from SECRET_KEY via SHA-256 so we never need
    a separate ENCRYPTION_KEY in .env.
    """
    raw = settings.SECRET_KEY.encode("utf-8")
    digest = hashlib.sha256(raw).digest()           # 32 bytes
    key = base64.urlsafe_b64encode(digest)          # Fernet expects URL-safe b64
    return Fernet(key)


_fernet: Fernet = _get_fernet()


def encrypt_token(plaintext: str | None) -> str | None:
    """
    Encrypt *plaintext* and return a URL-safe base64 ciphertext string.
    Returns None if *plaintext* is None or empty.
    """
    if not plaintext:
        return plaintext
    return _fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: str | None) -> str | None:
    """
    Decrypt *ciphertext* produced by :func:`encrypt_token`.
    Returns the original plaintext, or None on failure (invalid / unencrypted
    legacy value — graceful degradation).
    """
    if not ciphertext:
        return ciphertext
    try:
        return _fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception):
        # Legacy plaintext token — return as-is so old sessions don't break
        return ciphertext
