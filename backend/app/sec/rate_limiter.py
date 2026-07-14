"""
Rate Limiter
============
A singleton SlowAPI Limiter instance used across the application.
Keeping it in its own module avoids circular imports between main.py
and endpoint modules that need the limiter decorator.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Global rate limiter — 200 requests/minute per IP by default
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
