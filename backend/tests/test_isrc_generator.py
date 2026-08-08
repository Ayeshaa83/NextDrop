import datetime
import pytest
from app.crud.track import create_track
from app.schemas.track import TrackCreate
from app.models.artist import Artist
from app.models.user import User, UserRole
from app.services.isrc_generator import generate_next_isrc

def test_manual_isrc_preserved(db):
    """Test 1: Preserves manual ISRC if provided by artist."""
    # Create test artist
    user = User(email="artist1@example.com", hashed_password="pw", role=UserRole.ARTIST, is_active=True)
    db.add(user)
    db.commit()
    artist = Artist(user_id=user.id, stage_name="Manual Artist")
    db.add(artist)
    db.commit()

    manual_isrc = "US-XYZ-26-99999"
    track_in = TrackCreate(
        title="Manual ISRC Track",
        duration=180,
        file_url="http://example.com/audio.mp3",
        isrc=manual_isrc
    )

    track = create_track(db, track_in=track_in, artist_id=artist.id)
    assert track.isrc == manual_isrc

def test_auto_generate_isrc_format(db):
    """Test 2: Auto-generates format IN-ND1-26-00001 if ISRC is None or empty."""
    user = User(email="artist2@example.com", hashed_password="pw", role=UserRole.ARTIST, is_active=True)
    db.add(user)
    db.commit()
    artist = Artist(user_id=user.id, stage_name="Auto Artist")
    db.add(artist)
    db.commit()

    current_year_suffix = datetime.datetime.now().strftime("%y")
    expected_isrc = f"IN-ND1-{current_year_suffix}-00001"

    track_in = TrackCreate(
        title="Auto Generated Track",
        duration=200,
        file_url="http://example.com/audio2.mp3",
        isrc=None
    )

    track = create_track(db, track_in=track_in, artist_id=artist.id)
    assert track.isrc == expected_isrc

def test_isrc_sequential_increment(db):
    """Test 3: Increments sequentially (IN-ND1-26-00001 -> IN-ND1-26-00002)."""
    user = User(email="artist3@example.com", hashed_password="pw", role=UserRole.ARTIST, is_active=True)
    db.add(user)
    db.commit()
    artist = Artist(user_id=user.id, stage_name="Seq Artist")
    db.add(artist)
    db.commit()

    current_year_suffix = datetime.datetime.now().strftime("%y")
    expected_first = f"IN-ND1-{current_year_suffix}-00001"
    expected_second = f"IN-ND1-{current_year_suffix}-00002"

    track1_in = TrackCreate(
        title="Track 1",
        duration=150,
        file_url="http://example.com/t1.mp3",
        isrc=""
    )
    track1 = create_track(db, track_in=track1_in, artist_id=artist.id)
    assert track1.isrc == expected_first

    track2_in = TrackCreate(
        title="Track 2",
        duration=210,
        file_url="http://example.com/t2.mp3",
        isrc=None
    )
    track2 = create_track(db, track_in=track2_in, artist_id=artist.id)
    assert track2.isrc == expected_second
