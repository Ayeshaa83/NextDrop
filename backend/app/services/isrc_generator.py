import os
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.music import Track

def generate_next_isrc(db: Session) -> str:
    """
    Generates the next sequential ISRC code following IFPI standards:
    Format: [Country (2)]-[Registrant (3)]-[Year (2)]-[Serial (5)]
    Example: IN-ND1-26-00001
    """
    country_code = os.getenv("ISRC_COUNTRY_CODE", "IN").strip().upper()
    registrant_code = os.getenv("ISRC_REGISTRANT_CODE", "ND1").strip().upper()
    current_year_suffix = datetime.datetime.now().strftime("%y")

    prefix = f"{country_code}-{registrant_code}-{current_year_suffix}-"
    
    # Query database for existing tracks with ISRC starting with the current prefix
    max_isrc_track = (
        db.query(Track.isrc)
        .filter(Track.isrc.like(f"{prefix}%"))
        .order_by(Track.isrc.desc())
        .first()
    )

    if max_isrc_track and max_isrc_track.isrc:
        # Extract the 5-digit serial number from the end
        try:
            last_serial_str = max_isrc_track.isrc.split("-")[-1]
            last_serial = int(last_serial_str)
            next_serial = last_serial + 1
        except (ValueError, IndexError):
            next_serial = 1
    else:
        next_serial = 1

    return f"{prefix}{next_serial:05d}"
