"""
LLM Insights Service
====================
Thin wrapper around the Claude API used by the AI feature endpoints.
All callers must tolerate `None` results — when no ANTHROPIC_API_KEY is
configured (or a request fails), endpoints fall back to their heuristic
implementations so the product keeps working without an LLM.

Model comes from settings.INSIGHTS_MODEL (default: claude-sonnet-5).
"""
import json
import logging
from typing import Any, Optional

from app.sec.config import settings

logger = logging.getLogger(__name__)

try:
    import anthropic
except ImportError:  # SDK not installed — fallbacks handle everything
    anthropic = None

_client: Optional["anthropic.Anthropic"] = None


def is_available() -> bool:
    """True when the Claude SDK is installed and an API key is configured."""
    return anthropic is not None and bool(settings.ANTHROPIC_API_KEY)


def _get_client() -> Optional["anthropic.Anthropic"]:
    global _client
    if not is_available():
        return None
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


SYSTEM_PROMPT = (
    "You are the analytics insight engine for NextDrop, a music distribution "
    "platform for independent artists. You turn raw streaming data into "
    "clear, actionable guidance for non-technical musicians. Ground every "
    "statement in the data provided — never invent numbers that are not in "
    "the input. Keep the tone encouraging but honest, and keep advice "
    "specific and practical."
)


def generate_json(prompt: str, schema: dict[str, Any], max_tokens: int = 1500) -> Optional[dict]:
    """Ask Claude for a response constrained to the given JSON schema.

    Returns the parsed dict, or None on any failure (caller falls back).
    """
    client = _get_client()
    if client is None:
        return None

    try:
        response = client.messages.create(
            model=settings.INSIGHTS_MODEL,
            max_tokens=max_tokens,
            system=SYSTEM_PROMPT,
            output_config={"format": {"type": "json_schema", "schema": schema}},
            messages=[{"role": "user", "content": prompt}],
        )
        if response.stop_reason == "refusal" or not response.content:
            return None
        text_blocks = [b.text for b in response.content if b.type == "text"]
        if not text_blocks:
            return None
        return json.loads("".join(text_blocks))
    except Exception:
        logger.exception("LLM insight generation failed — falling back to heuristics")
        return None
