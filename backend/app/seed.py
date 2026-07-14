"""
NextDrop Seed Script
Populates the database with demo data for frontend development and testing.
"""

import random
from datetime import datetime, timedelta, date
from app.db.session import SessionLocal
from app.models import (
    User, Artist, Track, Album, AlbumTrack, TrackAnalytics, RevenuePrediction,
    Collaboration, Leaderboard, AnalyticsSnapshot, TrackDistribution, TrackCollaborator,
    Wallet, Payout, SocialPost, Comment, PostLike, UserRole, PostType,
)
from app.models.social import CollaborationStatus
from app.models.social_auth import SocialAccount, SocialStats
from app.sec.security import get_password_hash

# Regional distribution used for the 90-day sample dataset
COUNTRY_WEIGHTS = [
    ("IN", 0.28), ("US", 0.18), ("BR", 0.14), ("DE", 0.10),
    ("GB", 0.09), ("JP", 0.08), ("NG", 0.07), ("MX", 0.06),
]
HISTORY_DAYS = 90

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
    db.query(PostLike).delete()
    db.query(Comment).delete()
    db.query(SocialPost).delete()
    db.query(AnalyticsSnapshot).delete()
    db.query(TrackDistribution).delete()
    db.query(TrackCollaborator).delete()
    db.query(AlbumTrack).delete()
    db.query(TrackAnalytics).delete()
    db.query(RevenuePrediction).delete()
    db.query(Collaboration).delete()
    db.query(Leaderboard).delete()
    db.query(Payout).delete()
    db.query(Wallet).delete()
    db.query(SocialStats).delete()
    db.query(SocialAccount).delete()
    db.query(Track).delete()
    db.query(Album).delete()
    db.query(Artist).delete()
    db.query(User).delete()
    db.commit()
    print("Database cleared.")


def seed_admin(db):
    """Create the platform admin account."""
    admin = User(
        email="admin@nextdrop.ai",
        hashed_password=get_password_hash("admin1234"),
        full_name="Platform Admin",
        is_active=True,
        role=UserRole.ADMIN.value,
    )
    db.add(admin)
    db.commit()
    print("Created admin account (admin@nextdrop.ai / admin1234).")
    return admin


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
    """Build the 90-day sample dataset: daily per-platform, per-country
    snapshots, with aggregate analytics derived from them so every chart,
    territory list, and earnings figure reconciles."""
    print(f"Generating {HISTORY_DAYS}-day analytics history...")

    today = date.today()
    artist_totals = {}  # artist_id -> {"total": n, "spotify": n, "youtube": n}

    for track in tracks:
        # Each track gets its own popularity level and growth curve
        base_daily = random.randint(200, 6000)
        growth = random.uniform(0.99, 1.03)  # slight decay to strong growth
        spotify_share = random.uniform(0.35, 0.6)
        youtube_share = random.uniform(0.2, 0.45)

        spotify_total = youtube_total = other_total = 0

        for day_offset in range(HISTORY_DAYS):
            snap_date = today - timedelta(days=HISTORY_DAYS - 1 - day_offset)
            # Weekend bump + noise
            weekday_factor = 1.25 if snap_date.weekday() >= 4 else 1.0
            day_streams = int(base_daily * (growth ** day_offset) * weekday_factor * random.uniform(0.7, 1.3))
            if day_streams <= 0:
                continue

            splits = {
                "spotify": int(day_streams * spotify_share),
                "youtube": int(day_streams * youtube_share),
            }
            splits["other"] = max(0, day_streams - splits["spotify"] - splits["youtube"])

            for platform, platform_streams in splits.items():
                if platform_streams <= 0:
                    continue
                # Spread the platform's streams across countries
                remaining = platform_streams
                for i, (country, weight) in enumerate(COUNTRY_WEIGHTS):
                    is_last = i == len(COUNTRY_WEIGHTS) - 1
                    amount = remaining if is_last else int(platform_streams * weight * random.uniform(0.7, 1.3))
                    amount = min(amount, remaining)
                    if amount <= 0:
                        continue
                    db.add(AnalyticsSnapshot(
                        track_id=track.id, platform=platform,
                        snapshot_date=snap_date, streams=amount, country=country,
                    ))
                    remaining -= amount

                if platform == "spotify":
                    spotify_total += platform_streams
                elif platform == "youtube":
                    youtube_total += platform_streams
                else:
                    other_total += platform_streams

        streams = spotify_total + youtube_total + other_total
        saves = int(streams * random.uniform(0.01, 0.05))
        shares = int(streams * random.uniform(0.005, 0.02))

        db.add(TrackAnalytics(
            track_id=track.id,
            stream_count=streams,
            save_count=saves,
            share_count=shares,
            youtube_views=youtube_total,
            youtube_likes=int(youtube_total * 0.03),
            youtube_comments=int(youtube_total * 0.004),
            spotify_streams=spotify_total,
            spotify_saves=int(spotify_total * 0.02),
            hit_score=round(random.uniform(60, 99), 1),
            viral_velocity=round(shares / 24 + random.uniform(0, 500), 1),
            sentiment_data={
                "positive": round(random.uniform(0.6, 0.9), 2),
                "neutral": round(random.uniform(0.05, 0.25), 2),
                "negative": round(random.uniform(0.01, 0.15), 2)
            }
        ))

        totals = artist_totals.setdefault(track.artist_id, {"total": 0, "spotify": 0, "youtube": 0})
        totals["total"] += streams
        totals["spotify"] += spotify_total
        totals["youtube"] += youtube_total

    # Revenue predictions derived from the same numbers (matches earnings math)
    for artist in artists:
        totals = artist_totals.get(artist.id, {"total": 0, "spotify": 0, "youtube": 0})
        monthly_share = 30 / HISTORY_DAYS
        revenue = (
            totals["spotify"] * 0.004
            + totals["youtube"] * 0.001
            + max(0, totals["total"] - totals["spotify"] - totals["youtube"]) * 0.003
        ) * monthly_share
        db.add(RevenuePrediction(
            artist_id=artist.id,
            predicted_monthly_revenue=round(revenue, 2),
            confidence_interval=round(random.uniform(0.75, 0.95), 2)
        ))

    db.commit()
    print("Analytics history generated.")


DEMO_POSTS = [
    {"artist_idx": 0, "track_title": "Neon Nights", "type": PostType.SNIPPET,
     "content": "Fresh cut from the studio — that outro synth solo took 14 takes. Thoughts?"},
    {"artist_idx": 1, "track_title": "Midnight City", "type": PostType.OPEN_VERSE,
     "content": "Leaving verse 2 open on this one. Need a melodic rapper or a smoky alto. Stems on request 🎤"},
    {"artist_idx": 2, "track_title": "Tokyo Drift", "type": PostType.OPEN_VERSE,
     "content": "808s are done, hook is done — the bridge is yours. Show me what you got."},
    {"artist_idx": 3, "track_title": "Abyss", "type": PostType.SNIPPET,
     "content": "4 AM deep house session. This drop feels illegal."},
    {"artist_idx": 4, "track_title": None, "type": PostType.GENERAL,
     "content": "Just crossed 100K total streams as an independent artist. No label, no playlist payola — just you all. Thank you. 🙏"},
]


def seed_social_posts(db, artists, tracks):
    """Seed the Jam Jar feed and Open Verse marketplace."""
    print("Creating social posts...")
    track_by_title = {t.title: t for t in tracks}

    posts = []
    for post_data in DEMO_POSTS:
        track = track_by_title.get(post_data["track_title"]) if post_data["track_title"] else None
        post = SocialPost(
            artist_id=artists[post_data["artist_idx"]].id,
            track_id=track.id if track else None,
            content=post_data["content"],
            post_type=post_data["type"],
            created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 96)),
        )
        db.add(post)
        db.flush()
        posts.append(post)

        # A few likes and comments from other artists
        others = [a for a in artists if a.id != post.artist_id]
        for liker in random.sample(others, k=random.randint(1, len(others))):
            db.add(PostLike(post_id=post.id, artist_id=liker.id))
        commenter = random.choice(others)
        db.add(Comment(
            post_id=post.id, artist_id=commenter.id,
            text=random.choice([
                "This goes hard 🔥", "Sending a collab request right now.",
                "The mix is so clean. What chain are you running?", "Instant save.",
            ]),
        ))

    db.commit()
    print(f"Created {len(posts)} posts with likes and comments.")


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
        seed_admin(db)
        artists = seed_users_and_artists(db)

        # Verify the first two artists so the badge flow is demo-ready
        for artist in artists[:2]:
            artist.is_verified = True
            artist.verified_at = datetime.utcnow()
        db.commit()

        tracks = seed_tracks(db, artists)
        albums = seed_albums(db, artists, tracks)
        seed_analytics(db, tracks, artists)
        seed_collaborations(db, artists)
        seed_leaderboard(db, artists)
        seed_social_posts(db, artists, tracks)

        print("\n✅ Seed completed successfully!")
        print("\n📋 Demo Login Credentials:")
        print("   Artist: axion@nextdrop.ai / demo1234  (all artist accounts use demo1234)")
        print("   Admin:  admin@nextdrop.ai / admin1234")
        
    except Exception as e:
        print(f"\n❌ Seed failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
