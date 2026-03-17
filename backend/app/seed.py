"""
NextDrop Seed Script
Populates the database with demo data for frontend development and testing.
"""

import random
from datetime import datetime, timedelta
from app.db.session import SessionLocal
from app.models import User, Artist, Track, Album, AlbumTrack, TrackAnalytics, RevenuePrediction, Collaboration, Leaderboard
from app.models.social import CollaborationStatus
from app.sec.security import get_password_hash

# Demo Data
DEMO_ARTISTS = [
    {"email": "axion@nextdrop.ai", "stage_name": "Axion", "bio": "Synthwave producer pushing retro-future vibes.", "profile_picture": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=200&auto=format&fit=crop"},
    {"email": "lunasol@nextdrop.ai", "stage_name": "Luna Sol", "bio": "R&B vocalist with a cosmic touch.", "profile_picture": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop"},
    {"email": "kaix@nextdrop.ai", "stage_name": "KAI_X", "bio": "Trap beats. Tokyo nights. Endless flow.", "profile_picture": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&auto=format&fit=crop"},
    {"email": "resonance@nextdrop.ai", "stage_name": "RESONANCE", "bio": "Deep house producer exploring sonic depths.", "profile_picture": "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?q=80&w=200&auto=format&fit=crop"},
    {"email": "verablue@nextdrop.ai", "stage_name": "Vera Blue", "bio": "Indie electronic with dreamscape vocals.", "profile_picture": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop"},
]

DEMO_TRACKS = [
    # Axion tracks
    {"title": "Neon Nights", "duration": 228, "genre": "Synthwave", "bpm": 118, "artist_idx": 0},
    {"title": "Cybernetic", "duration": 178, "genre": "Synthwave", "bpm": 125, "artist_idx": 0},
    {"title": "Retrograde", "duration": 204, "genre": "Synthwave", "bpm": 110, "artist_idx": 0},
    {"title": "Circuit Breaker", "duration": 195, "genre": "Synthwave", "bpm": 122, "artist_idx": 0},
    # Luna Sol tracks
    {"title": "Midnight City", "duration": 200, "genre": "R&B", "bpm": 95, "artist_idx": 1},
    {"title": "Neon Rain", "duration": 235, "genre": "R&B", "bpm": 88, "artist_idx": 1},
    {"title": "Starlight", "duration": 231, "genre": "R&B", "bpm": 92, "artist_idx": 1},
    # KAI_X tracks
    {"title": "Tokyo Drift", "duration": 185, "genre": "Trap", "bpm": 140, "artist_idx": 2},
    {"title": "Highway 99", "duration": 172, "genre": "Trap", "bpm": 145, "artist_idx": 2},
    {"title": "Lucid", "duration": 261, "genre": "Trap", "bpm": 138, "artist_idx": 2},
    # RESONANCE tracks
    {"title": "Abyss", "duration": 320, "genre": "Deep House", "bpm": 128, "artist_idx": 3},
    {"title": "Horizon", "duration": 291, "genre": "Deep House", "bpm": 124, "artist_idx": 3},
    # Vera Blue tracks
    {"title": "Crystalized", "duration": 245, "genre": "Indie Electronic", "bpm": 105, "artist_idx": 4},
    {"title": "Synesthesia", "duration": 198, "genre": "Indie Electronic", "bpm": 112, "artist_idx": 4},
]

DEMO_ALBUMS = [
    {"title": "Midnight Protocol", "artist_idx": 0, "track_indices": [0, 1, 2]},
    {"title": "Cosmic Sessions", "artist_idx": 1, "track_indices": [4, 5, 6]},
    {"title": "Tokyo Tapes", "artist_idx": 2, "track_indices": [7, 8, 9]},
]

LEADERBOARD_CATEGORIES = ["Top Tracks", "Viral Producers", "Most Collaborative", "Rising Stars", "Open Verse Champions"]


def clear_database(db):
    """Clear all data from tables (in proper order to respect FK constraints)."""
    print("Clearing existing data...")
    db.query(AlbumTrack).delete()
    db.query(TrackAnalytics).delete()
    db.query(RevenuePrediction).delete()
    db.query(Collaboration).delete()
    db.query(Leaderboard).delete()
    db.query(Track).delete()
    db.query(Album).delete()
    db.query(Artist).delete()
    db.query(User).delete()
    db.commit()
    print("Database cleared.")


def seed_users_and_artists(db):
    """Create demo users and artist profiles."""
    print("Creating users and artists...")
    artists = []
    
    for artist_data in DEMO_ARTISTS:
        # Create user
        user = User(
            email=artist_data["email"],
            hashed_password=get_password_hash("demo1234"),
            is_active=True,
            is_premium=random.choice([True, False])
        )
        db.add(user)
        db.flush()  # Get the user ID
        
        # Create artist profile
        artist = Artist(
            user_id=user.id,
            stage_name=artist_data["stage_name"],
            bio=artist_data["bio"],
            profile_picture=artist_data["profile_picture"]
        )
        db.add(artist)
        db.flush()
        artists.append(artist)
    
    db.commit()
    print(f"Created {len(artists)} artists.")
    return artists


def seed_tracks(db, artists):
    """Create demo tracks."""
    print("Creating tracks...")
    tracks = []
    
    for track_data in DEMO_TRACKS:
        artist = artists[track_data["artist_idx"]]
        track = Track(
            artist_id=artist.id,
            title=track_data["title"],
            duration=track_data["duration"],
            file_url=f"https://storage.nextdrop.ai/tracks/{track_data['title'].lower().replace(' ', '-')}.mp3",
            genre=track_data["genre"],
            bpm=track_data["bpm"],
            is_public=True
        )
        db.add(track)
        db.flush()
        tracks.append(track)
    
    db.commit()
    print(f"Created {len(tracks)} tracks.")
    return tracks


def seed_albums(db, artists, tracks):
    """Create demo albums and link tracks."""
    print("Creating albums...")
    albums = []
    
    for album_data in DEMO_ALBUMS:
        artist = artists[album_data["artist_idx"]]
        album = Album(
            artist_id=artist.id,
            title=album_data["title"],
            cover_art_url=f"https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=500&auto=format&fit=crop",
            release_date=datetime.now() - timedelta(days=random.randint(30, 365))
        )
        db.add(album)
        db.flush()
        albums.append(album)
        
        # Link tracks to album
        for position, track_idx in enumerate(album_data["track_indices"], 1):
            link = AlbumTrack(
                album_id=album.id,
                track_id=tracks[track_idx].id,
                position=position
            )
            db.add(link)
    
    db.commit()
    print(f"Created {len(albums)} albums.")
    return albums


def seed_analytics(db, tracks, artists):
    """Create mock analytics data for all tracks."""
    print("Generating analytics data...")
    
    for track in tracks:
        streams = random.randint(10000, 2000000)
        saves = int(streams * random.uniform(0.01, 0.05))
        shares = int(streams * random.uniform(0.005, 0.02))
        
        analytics = TrackAnalytics(
            track_id=track.id,
            stream_count=streams,
            save_count=saves,
            share_count=shares,
            hit_score=round(random.uniform(60, 99), 1),
            viral_velocity=round(shares / 24 + random.uniform(0, 500), 1),
            sentiment_data={
                "positive": round(random.uniform(0.6, 0.9), 2),
                "neutral": round(random.uniform(0.05, 0.25), 2),
                "negative": round(random.uniform(0.01, 0.15), 2)
            }
        )
        db.add(analytics)
    
    # Create revenue predictions for each artist
    for artist in artists:
        artist_tracks = [t for t in tracks if t.artist_id == artist.id]
        total_streams = sum(random.randint(50000, 500000) for _ in artist_tracks)
        
        prediction = RevenuePrediction(
            artist_id=artist.id,
            predicted_monthly_revenue=round((total_streams / 1000) * 3.5, 2),
            confidence_interval=round(random.uniform(0.75, 0.95), 2)
        )
        db.add(prediction)
    
    db.commit()
    print("Analytics data generated.")


def seed_collaborations(db, artists):
    """Create some demo collaboration requests."""
    print("Creating collaborations...")
    
    collabs = [
        {"initiator": 0, "collaborator": 1, "status": CollaborationStatus.ACCEPTED, "message": "Let's collab on a synthwave R&B track!"},
        {"initiator": 2, "collaborator": 0, "status": CollaborationStatus.PENDING, "message": "Your synths would be fire on my next trap beat."},
        {"initiator": 1, "collaborator": 4, "status": CollaborationStatus.COMPLETED, "message": "That session was amazing!"},
        {"initiator": 3, "collaborator": 2, "status": CollaborationStatus.PENDING, "message": "Deep house meets trap?"},
    ]
    
    for collab_data in collabs:
        collab = Collaboration(
            initiator_id=artists[collab_data["initiator"]].id,
            collaborator_id=artists[collab_data["collaborator"]].id,
            status=collab_data["status"],
            message=collab_data["message"]
        )
        db.add(collab)
    
    db.commit()
    print("Collaborations created.")


def seed_leaderboard(db, artists):
    """Create leaderboard entries."""
    print("Populating leaderboard...")
    
    for category in LEADERBOARD_CATEGORIES:
        shuffled = artists.copy()
        random.shuffle(shuffled)
        
        for rank, artist in enumerate(shuffled, 1):
            entry = Leaderboard(
                artist_id=artist.id,
                rank=rank,
                points=random.randint(1000, 50000) - (rank * 500),
                category=category
            )
            db.add(entry)
    
    db.commit()
    print("Leaderboard populated.")


def run_seed():
    """Main seed function."""
    print("\n🚀 Starting NextDrop Database Seed...\n")
    
    db = SessionLocal()
    
    try:
        clear_database(db)
        artists = seed_users_and_artists(db)
        tracks = seed_tracks(db, artists)
        albums = seed_albums(db, artists, tracks)
        seed_analytics(db, tracks, artists)
        seed_collaborations(db, artists)
        seed_leaderboard(db, artists)
        
        print("\n✅ Seed completed successfully!")
        print("\n📋 Demo Login Credentials:")
        print("   Email: axion@nextdrop.ai")
        print("   Password: demo1234")
        print("\n   (All demo accounts use password: demo1234)")
        
    except Exception as e:
        print(f"\n❌ Seed failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
