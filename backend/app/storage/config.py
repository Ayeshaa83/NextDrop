"""
Storage Configuration for S3-Compatible Object Storage

Supports: AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

StorageProvider = Literal["s3", "r2", "spaces", "minio"]


@dataclass
class StorageConfig:
    """Configuration for S3-compatible object storage."""
    
    # Provider type
    provider: StorageProvider
    
    # Connection settings
    access_key_id: str
    secret_access_key: str
    bucket_name: str
    region: str
    
    # Endpoint URL (required for R2, Spaces, MinIO)
    endpoint_url: str | None = None
    
    # CDN/Public URL for serving files (optional)
    # If set, download URLs will use this domain instead of presigned URLs
    public_url: str | None = None
    
    # Default expiration for presigned URLs (seconds)
    upload_expiration: int = 3600  # 1 hour
    download_expiration: int = 86400  # 24 hours
    
    # File constraints
    max_audio_size_mb: int = 100  # Max audio file size
    max_image_size_mb: int = 10   # Max image file size
    
    # Allowed file types
    allowed_audio_types: tuple = ("audio/mpeg", "audio/wav", "audio/flac", "audio/aac", "audio/ogg")
    allowed_image_types: tuple = ("image/jpeg", "image/png", "image/webp", "image/gif")
    
    @property
    def max_audio_size_bytes(self) -> int:
        return self.max_audio_size_mb * 1024 * 1024
    
    @property
    def max_image_size_bytes(self) -> int:
        return self.max_image_size_mb * 1024 * 1024


@lru_cache()
def get_storage_config() -> StorageConfig:
    """
    Load storage configuration from environment variables.
    
    Required env vars:
        STORAGE_PROVIDER: s3 | r2 | spaces | minio
        STORAGE_ACCESS_KEY_ID: Your access key
        STORAGE_SECRET_ACCESS_KEY: Your secret key
        STORAGE_BUCKET_NAME: Bucket name
        STORAGE_REGION: Region (e.g., us-east-1, auto for R2)
    
    Optional env vars:
        STORAGE_ENDPOINT_URL: Custom endpoint (required for R2/Spaces/MinIO)
        STORAGE_PUBLIC_URL: CDN URL for public file access
        STORAGE_UPLOAD_EXPIRATION: Upload URL expiration in seconds
        STORAGE_DOWNLOAD_EXPIRATION: Download URL expiration in seconds
    """
    provider = os.getenv("STORAGE_PROVIDER", "s3").lower()
    
    # Validate provider
    if provider not in ("s3", "r2", "spaces", "minio"):
        raise ValueError(f"Invalid STORAGE_PROVIDER: {provider}")
    
    config = StorageConfig(
        provider=provider,  # type: ignore
        access_key_id=os.getenv("STORAGE_ACCESS_KEY_ID", ""),
        secret_access_key=os.getenv("STORAGE_SECRET_ACCESS_KEY", ""),
        bucket_name=os.getenv("STORAGE_BUCKET_NAME", "nextdrop"),
        region=os.getenv("STORAGE_REGION", "auto"),
        endpoint_url=os.getenv("STORAGE_ENDPOINT_URL"),
        public_url=os.getenv("STORAGE_PUBLIC_URL"),
        upload_expiration=int(os.getenv("STORAGE_UPLOAD_EXPIRATION", "3600")),
        download_expiration=int(os.getenv("STORAGE_DOWNLOAD_EXPIRATION", "86400")),
    )
    
    return config


# Provider-specific endpoint templates
PROVIDER_ENDPOINTS = {
    "r2": "https://{account_id}.r2.cloudflarestorage.com",
    "spaces": "https://{region}.digitaloceanspaces.com",
    "minio": "http://localhost:9000",  # Default MinIO
}
