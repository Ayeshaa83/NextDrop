from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Your existing database URL
    DATABASE_URL: str
    
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
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

    model_config = SettingsConfigDict(
        env_file=".env", 
        extra="ignore"  
    )

settings = Settings()