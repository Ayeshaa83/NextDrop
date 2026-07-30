"""
Runner — Subprocess orchestrator for the Musicnn tagger.

Spawns tagger_musicnn.py in a separate process to isolate TensorFlow
from the main FastAPI server. Parses the RESULT:{json} output and
maps raw tags into structured categories via tag_mapper.py.
"""
import os
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"  # Force CPU only — prevents GPU/RAM conflicts

import subprocess
import sys
import json
import logging
from typing import Dict, Any, Optional

from ai_engine.tag_mapper import map_tags

logger = logging.getLogger(__name__)

_AI_ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))

# Path to the tagger script
_TAGGER_SCRIPT = os.path.join(_AI_ENGINE_DIR, "tagger_musicnn.py")

# Timeout for the musicnn subprocess (seconds)
_SUBPROCESS_TIMEOUT = 120


def _resolve_musicnn_python() -> str:
    """
    MusicCNN needs tensorflow==1.15 + numpy<1.17, which conflict with the
    main app's modern dependencies — so it runs in an isolated interpreter.

    Resolution order:
      1. settings.MUSICNN_PYTHON_PATH (explicit — used in Docker/deploy)
      2. ai_engine/musicnn_env/{Scripts,bin}/python(.exe) if it exists
         (the local dev venv created per backend/ai_engine/README.md)
      3. sys.executable (last resort — will error clearly if musicnn/tf1.15
         aren't installed there, same as before this existed)
    """
    try:
        from app.sec.config import settings
        if settings.MUSICNN_PYTHON_PATH:
            configured = settings.MUSICNN_PYTHON_PATH
            # Relative paths resolve against ai_engine/ itself, not the
            # server's cwd — works the same regardless of where uvicorn
            # was started from. e.g. "musicnn_env/Scripts/python.exe"
            return configured if os.path.isabs(configured) else os.path.join(_AI_ENGINE_DIR, configured)
    except Exception:
        pass  # Config not available (e.g. run standalone) — fall through

    for candidate in (
        os.path.join(_AI_ENGINE_DIR, "musicnn_env", "Scripts", "python.exe"),  # Windows
        os.path.join(_AI_ENGINE_DIR, "musicnn_env", "bin", "python"),          # Linux/Mac
    ):
        if os.path.exists(candidate):
            return candidate

    return sys.executable


def run_musicnn_tagger(audio_path: str) -> Dict[str, Any]:
    """
    Run the musicnn tagger in a subprocess and return structured results.

    Args:
        audio_path: Absolute path to the audio file to analyze.

    Returns:
        Dict with keys:
            - tags_raw: List of {"tag": str, "score": float} from musicnn
            - genre: List of {"name": str, "confidence": int}
            - style: List of {"name": str, "confidence": int}
            - mood: List of {"name": str, "confidence": int}
            - instruments: List of {"name": str, "confidence": int}
            - vocals: List of {"name": str, "confidence": int}
            - error: Optional error message
    """
    if not os.path.exists(audio_path):
        return _empty_result(error=f"Audio file not found: {audio_path}")

    if not os.path.exists(_TAGGER_SCRIPT):
        return _empty_result(error=f"Tagger script not found: {_TAGGER_SCRIPT}")

    try:
        python_exe = _resolve_musicnn_python()

        logger.info(f"Spawning musicnn tagger subprocess ({python_exe}) for: {audio_path}")

        result = subprocess.run(
            [python_exe, _TAGGER_SCRIPT, audio_path],
            capture_output=True,
            text=True,
            timeout=_SUBPROCESS_TIMEOUT,
            cwd=os.path.dirname(_TAGGER_SCRIPT),
            env={
                **os.environ,
                "CUDA_VISIBLE_DEVICES": "-1",  # Redundant but explicit
            },
        )

        # Parse stdout for the RESULT: line
        raw_tags = _parse_result_output(result.stdout)

        if raw_tags is None:
            # Check stderr for errors
            stderr_msg = result.stderr.strip()[-500:] if result.stderr else "No output"
            logger.warning(f"Musicnn tagger produced no result. stderr: {stderr_msg}")
            return _empty_result(error=f"Tagger produced no result. Exit code: {result.returncode}")

        if "error" in raw_tags:
            logger.warning(f"Musicnn tagger error: {raw_tags['error']}")
            return _empty_result(error=raw_tags["error"])

        # Map raw tags into structured categories
        tags_list = raw_tags.get("tags", [])
        mapped = map_tags(tags_list)

        return {
            "tags_raw": tags_list,
            **mapped,
            "error": None,
        }

    except subprocess.TimeoutExpired:
        logger.error(f"Musicnn tagger timed out after {_SUBPROCESS_TIMEOUT}s")
        return _empty_result(error=f"Analysis timed out after {_SUBPROCESS_TIMEOUT}s")

    except Exception as e:
        logger.error(f"Musicnn tagger subprocess failed: {e}")
        return _empty_result(error=str(e))


def _parse_result_output(stdout: str) -> Optional[Dict]:
    """Parse the RESULT:{json} line from subprocess stdout."""
    if not stdout:
        return None

    for line in stdout.strip().split("\n"):
        line = line.strip()
        if line.startswith("RESULT:"):
            json_str = line[len("RESULT:"):]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse tagger JSON: {e}")
                return None

    return None


def _empty_result(error: str = None) -> Dict[str, Any]:
    """Return an empty structured result."""
    return {
        "tags_raw": [],
        "genre": [],
        "style": [],
        "mood": [],
        "instruments": [],
        "vocals": [],
        "error": error,
    }
