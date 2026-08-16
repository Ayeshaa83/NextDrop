"""
Patch broken storage.nextdrop.ai track URLs with working sample MP3s.
Run from d:\\NextDrop-1\\backend:
    python fix_audio_urls.py
"""

from app.db.session import SessionLocal
from app.models import Track

SAMPLE_MP3S = [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
]

db = SessionLocal()
try:
    broken = db.query(Track).filter(Track.file_url.like("%storage.nextdrop.ai%")).all()
    if not broken:
        print("[OK] No broken URLs found - nothing to fix.")
    else:
        print(f"Found {len(broken)} track(s) with broken URLs. Patching...")
        for i, track in enumerate(broken):
            new_url = SAMPLE_MP3S[i % len(SAMPLE_MP3S)]
            print(f"  [{track.id}] \"{track.title}\": {track.file_url!r} -> {new_url!r}")
            track.file_url = new_url
        db.commit()
        print(f"\n[OK] Patched {len(broken)} track(s) successfully.")
except Exception as e:
    db.rollback()
    print(f"[ERROR] {e}")
    raise
finally:
    db.close()
