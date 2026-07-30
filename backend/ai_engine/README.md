# MusicCNN Auto-Tagger — Isolated Environment

MusicCNN (genre/mood/instrument/vocal tagging) requires `tensorflow==1.15` and
`numpy<1.17`, which conflict with the main app's modern dependencies
(numpy 2.x, no TensorFlow). It runs in a **separate, isolated Python 3.7
interpreter**, invoked as a subprocess by `runner.py` — the main app never
imports `musicnn` or `tensorflow` directly.

If this environment isn't set up, uploads still work end-to-end — tagging
simply comes back empty and `/suggest-metadata` falls back to its heuristic
path. Nothing else breaks.

## Local setup (Windows)

```powershell
# 1. Install Python 3.7 (one-time)
winget install --id Python.Python.3.7 -e

# 2. Create the isolated venv, from backend/ai_engine/
py -3.7 -m venv musicnn_env

# 3. Install the pinned, isolated dependencies
musicnn_env\Scripts\pip install "tensorflow==1.15.0" "numpy<1.17,>=1.14.5" musicnn
```

Then in `backend/.env`:

```
MUSICNN_PYTHON_PATH=musicnn_env/Scripts/python.exe
```

(Relative paths resolve against this `ai_engine/` folder, so this works
regardless of the directory the backend server is started from.)

## Local setup (macOS / Linux)

```bash
# Requires a Python 3.7 interpreter available, e.g. via pyenv:
#   pyenv install 3.7.17
python3.7 -m venv musicnn_env
musicnn_env/bin/pip install "tensorflow==1.15.0" "numpy<1.17,>=1.14.5" musicnn
```

```
MUSICNN_PYTHON_PATH=musicnn_env/bin/python
```

## Docker / production deployment

The main `backend/Dockerfile` builds a modern Python 3.12 image, which
cannot host this isolated 3.7 environment as-is — Python 3.7 isn't in
current Debian's default package repos, and TensorFlow 1.15 has no wheel
for Python 3.8+. Two supported approaches:

1. **Build it into the image** — add a build stage that installs Python 3.7
   (e.g. via `deadsnakes`-style source build, or a `python:3.7-slim` stage
   whose `/opt` is copied into the final image) and creates the venv at
   `/opt/musicnn_env`, then set `MUSICNN_PYTHON_PATH=/opt/musicnn_env/bin/python`
   in the container's environment.
2. **Run it as a sidecar container** — a tiny `python:3.7-slim` image with
   this folder's contents + the pinned deps, exposed as a small internal
   service the main backend calls instead of a local subprocess.

Neither is wired up yet — this is a deployment-day task, not required for
local development or the demo dataset.
