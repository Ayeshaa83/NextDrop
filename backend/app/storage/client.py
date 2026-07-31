"""
S3-Compatible Storage Client for Presigned URL Generation

This module handles:
- Generating presigned URLs for direct browser uploads
- Generating presigned/public URLs for downloads
- File path management with organized structure
"""

import uuid
import mimetypes
from datetime import datetime
from functools import lru_cache
from typing import Literal
from dataclasses import dataclass

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .config import StorageConfig, get_storage_config

FileCategory = Literal["tracks", "covers", "avatars"]


@dataclass
class PresignedUploadResponse:
    """Response containing presigned URL and metadata for upload."""
    upload_url: str
    file_key: str
    file_url: str  # Final URL after upload completes
    expires_in: int
    max_size_bytes: int
    allowed_content_types: list[str]


@dataclass
class PresignedDownloadResponse:
    """Response containing presigned/public URL for download."""
    download_url: str
    expires_in: int | None  # None if using public CDN URL


class StorageClient:
    """
    Client for S3-compatible object storage operations.
    
    Designed for direct browser uploads (presigned URLs) to avoid
    server memory/bandwidth bottlenecks.
    """
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self._client = self._create_client()
    
    def _create_client(self):
        """Create boto3 S3 client with provider-specific configuration."""
        client_config = Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'}  # Required for R2, Spaces
        )
        
        client_kwargs = {
            'service_name': 's3',
            'aws_access_key_id': self.config.access_key_id,
            'aws_secret_access_key': self.config.secret_access_key,
            'region_name': self.config.region,
            'config': client_config,
        }
        
        # Add custom endpoint for non-AWS providers
        if self.config.endpoint_url:
            client_kwargs['endpoint_url'] = self.config.endpoint_url
        
        return boto3.client(**client_kwargs)
    
    def _generate_file_key(
        self,
        category: FileCategory,
        artist_id: int,
        filename: str,
        track_id: int | None = None
    ) -> str:
        """
        Generate organized file path/key for storage.
        
        Structure:
            tracks/{artist_id}/{track_id}/{uuid}_{filename}
            covers/{artist_id}/albums/{uuid}_{filename}
            avatars/{artist_id}/{uuid}_{filename}
        """
        # Sanitize filename
        safe_filename = "".join(c for c in filename if c.isalnum() or c in ".-_").lower()
        unique_id = uuid.uuid4().hex[:8]
        timestamp = datetime.utcnow().strftime("%Y%m")
        
        if category == "tracks":
            if track_id:
                return f"tracks/{artist_id}/{track_id}/{unique_id}_{safe_filename}"
            return f"tracks/{artist_id}/{timestamp}/{unique_id}_{safe_filename}"
        
        elif category == "covers":
            return f"covers/{artist_id}/{timestamp}/{unique_id}_{safe_filename}"
        
        elif category == "avatars":
            return f"avatars/{artist_id}/{unique_id}_{safe_filename}"
        
        raise ValueError(f"Invalid category: {category}")
    
    def _get_content_type(self, filename: str) -> str:
        """Determine content type from filename."""
        content_type, _ = mimetypes.guess_type(filename)
        return content_type or "application/octet-stream"

    def _category_from_key(self, file_key: str) -> str:
        """File keys always start with their category, e.g. 'avatars/7/x.jpg'."""
        return file_key.split('/', 1)[0]

    def _bucket_for(self, category: str) -> str:
        """Resolve which bucket a category lives in — most categories share
        the default bucket, but e.g. avatars can be routed to their own via
        STORAGE_BUCKET_AVATARS."""
        return self.config.category_buckets.get(category, self.config.bucket_name)

    def _public_url_for(self, category: str) -> str | None:
        if category in self.config.category_public_urls:
            return self.config.category_public_urls[category]
        # Only fall back to the default public_url when this category is
        # ALSO in the default bucket — otherwise we'd build a URL pointing
        # at the wrong bucket entirely (e.g. avatars routed to their own
        # bucket but with no public URL of their own configured yet).
        if category in self.config.category_buckets:
            return None
        return self.config.public_url

    # Longest expiry SigV4 allows for long-term (non-STS) credentials.
    _MAX_PRESIGN_EXPIRY = 604800  # 7 days, in seconds

    def _get_file_url(self, file_key: str, category: str | None = None) -> str:
        """
        Get the URL for accessing a file after upload. This is stored
        permanently (Track.file_url, Artist.profile_picture, ...), so it
        must actually keep working — a bare `endpoint/bucket/key` URL only
        works if the bucket is public, and we can't assume that.

        - public_url configured (for this category, or the default) -> bucket
          is public, bare URL is fine and never expires.
        - otherwise -> presign a GET at the longest expiry SigV4 allows.
          Not truly permanent (7 days), but works today without requiring
          the bucket to be public; make the bucket public and set
          STORAGE_PUBLIC_URL (or STORAGE_PUBLIC_URL_AVATARS) for a link that
          never expires.
        """
        category = category or self._category_from_key(file_key)
        bucket = self._bucket_for(category)
        public_url = self._public_url_for(category)

        if public_url:
            return f"{public_url.rstrip('/')}/{file_key}"

        if self.config.endpoint_url:
            try:
                return self._client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket, 'Key': file_key},
                    ExpiresIn=self._MAX_PRESIGN_EXPIRY,
                )
            except ClientError as e:
                raise RuntimeError(f"Failed to generate file URL: {e}")

        # AWS S3 default (public-by-bucket-policy is the norm here)
        return f"https://{bucket}.s3.{self.config.region}.amazonaws.com/{file_key}"
    
    def generate_upload_url(
        self,
        category: FileCategory,
        artist_id: int,
        filename: str,
        content_type: str | None = None,
        track_id: int | None = None
    ) -> PresignedUploadResponse:
        """
        Generate a presigned URL for direct browser upload.
        
        Args:
            category: Type of file (tracks, covers, avatars)
            artist_id: Artist ID for organization
            filename: Original filename
            content_type: MIME type (auto-detected if not provided)
            track_id: Optional track ID for track files
        
        Returns:
            PresignedUploadResponse with URL and metadata
        """
        # Auto-detect content type
        if not content_type:
            content_type = self._get_content_type(filename)
        
        # Validate content type
        if category == "tracks":
            allowed_types = list(self.config.allowed_audio_types)
            max_size = self.config.max_audio_size_bytes
            if content_type not in allowed_types:
                raise ValueError(f"Invalid audio type: {content_type}. Allowed: {allowed_types}")
        else:
            allowed_types = list(self.config.allowed_image_types)
            max_size = self.config.max_image_size_bytes
            if content_type not in allowed_types:
                raise ValueError(f"Invalid image type: {content_type}. Allowed: {allowed_types}")
        
        # Generate unique file key
        file_key = self._generate_file_key(category, artist_id, filename, track_id)
        bucket = self._bucket_for(category)

        # Generate presigned URL for PUT
        try:
            upload_url = self._client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': bucket,
                    'Key': file_key,
                    'ContentType': content_type,
                },
                ExpiresIn=self.config.upload_expiration,
                HttpMethod='PUT'
            )
        except ClientError as e:
            raise RuntimeError(f"Failed to generate upload URL: {e}")

        return PresignedUploadResponse(
            upload_url=upload_url,
            file_key=file_key,
            file_url=self._get_file_url(file_key, category),
            expires_in=self.config.upload_expiration,
            max_size_bytes=max_size,
            allowed_content_types=allowed_types
        )
    
    def generate_download_url(
        self,
        file_key: str,
        filename: str | None = None
    ) -> PresignedDownloadResponse:
        """
        Generate a URL for downloading/streaming a file.
        
        If a public URL is configured, returns that directly.
        Otherwise generates a presigned download URL.
        
        Args:
            file_key: The S3 key of the file
            filename: Optional filename for Content-Disposition header
        
        Returns:
            PresignedDownloadResponse with URL
        """
        category = self._category_from_key(file_key)
        bucket = self._bucket_for(category)
        public_url = self._public_url_for(category)

        # Use public/CDN URL if available
        if public_url:
            return PresignedDownloadResponse(
                download_url=f"{public_url.rstrip('/')}/{file_key}",
                expires_in=None
            )

        # Generate presigned URL for GET
        params = {
            'Bucket': bucket,
            'Key': file_key,
        }
        
        if filename:
            params['ResponseContentDisposition'] = f'attachment; filename="{filename}"'
        
        try:
            download_url = self._client.generate_presigned_url(
                'get_object',
                Params=params,
                ExpiresIn=self.config.download_expiration
            )
        except ClientError as e:
            raise RuntimeError(f"Failed to generate download URL: {e}")
        
        return PresignedDownloadResponse(
            download_url=download_url,
            expires_in=self.config.download_expiration
        )
    
    def delete_file(self, file_key: str) -> bool:
        """
        Delete a file from storage.
        
        Args:
            file_key: The S3 key of the file to delete
        
        Returns:
            True if successful
        """
        try:
            self._client.delete_object(
                Bucket=self._bucket_for(self._category_from_key(file_key)),
                Key=file_key
            )
            return True
        except ClientError as e:
            raise RuntimeError(f"Failed to delete file: {e}")

    def file_exists(self, file_key: str) -> bool:
        """Check if a file exists in storage."""
        try:
            self._client.head_object(
                Bucket=self._bucket_for(self._category_from_key(file_key)),
                Key=file_key
            )
            return True
        except ClientError:
            return False


@lru_cache()
def get_storage_client() -> StorageClient:
    """Get cached storage client instance."""
    config = get_storage_config()
    return StorageClient(config)
