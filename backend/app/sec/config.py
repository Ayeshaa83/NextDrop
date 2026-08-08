from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Your existing database URL
    DATABASE_URL: str
    # Optional DB IP override to bypass local DNS issues in development.
    DATABASE_HOSTADDR: str = ""
    
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # "Remember me" on login extends the session to this many days instead.
    REMEMBER_ME_EXPIRE_DAYS: int = 30
    
    # Cookie settings for HttpOnly JWT
    COOKIE_NAME: str = "nextdrop_access_token"
    COOKIE_SECURE: bool = False  # Set to True in production (requires HTTPS)
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"  # "lax" for same-site, "none" for cross-site (requires Secure=True)
    COOKIE_DOMAIN: str | None = None  # Set to your domain in production
    
    # Spotify OAuth
    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    SPOTIFY_REDIRECT_URI: str = "http://localhost:8000/api/v1/spotify/callback"
    FRONTEND_URL: str = "http://localhost:3000"
    
    # YouTube/Google OAuth
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_REDIRECT_URI: str = "http://localhost:8000/api/v1/youtube/callback"

    # Google Sign-In (separate OAuth client from the YouTube integration above —
    # this one only needs openid/email/profile scope to log a user in).
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Instagram
    INSTAGRAM_ACCESS_TOKEN: str = ""
    INSTAGRAM_ACCOUNT_ID: str = ""

    # Simulation Mode
    DEMO_MODE: bool = True

    # ISRC Defaults
    ISRC_COUNTRY_CODE: str = "IN"
    ISRC_REGISTRANT_CODE: str = "ND1"

    # LLM insights (Claude API). Empty = heuristic fallbacks are used.
    ANTHROPIC_API_KEY: str = ""
    INSIGHTS_MODEL: str = "claude-sonnet-5"

    # Email (Gmail SMTP). Empty SMTP_USER/PASSWORD = console/log mode.
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM_NAME: str = "NextDrop"
    # Password-reset links expire after this many minutes
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    # MusicCNN runs in an ISOLATED Python interpreter because it requires
    # tensorflow==1.15 + numpy<1.17, which conflict with the main app's
    # modern dependencies. Empty = fall back to the main interpreter (will
    # fail with a clear error if musicnn/tf1.15 aren't installed there).
    # Local dev (Windows):   ai_engine/musicnn_env/Scripts/python.exe
    # Docker/Linux deploy:   /opt/musicnn_env/bin/python  (see ARCHITECTURE.md)
    MUSICNN_PYTHON_PATH: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", 
        extra="ignore"  
    )

settings = Settings()