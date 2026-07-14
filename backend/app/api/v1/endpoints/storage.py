"""
Storage API Endpoints

Handles presigned URL generation for direct browser uploads.
"""

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_artist
from app.models import Artist
from app.storage import get_storage_client, StorageClient

router = APIRouter()


# ============ Request/Response Schemas ============

class UploadUrlRequest(BaseModel):
    """Request model for generating an upload URL."""
    filename: str = Field(..., description="Original filename with extension")
    content_type: str | None = Field(None, description="MIME type (auto-detected if omitted)")
    category: Literal["tracks", "covers", "avatars"] = Field(..., description="File category")
    track_id: int | None = Field(None, description="Track ID (for track files)")


class UploadUrlResponse(BaseModel):
    """Response containing presigned upload URL and metadata."""
    upload_url: str = Field(..., description="Presigned URL for PUT request")
    file_key: str = Field(..., description="Storage key for the file")
    file_url: str = Field(..., description="Final URL after upload completes")
    expires_in: int = Field(..., description="URL expiration in seconds")
    max_size_bytes: int = Field(..., description="Maximum allowed file size")
    allowed_content_types: list[str] = Field(..., description="Allowed MIME types")


class DownloadUrlRequest(BaseModel):
    """Request model for generating a download URL."""
    file_key: str = Field(..., description="Storage key of the file")
    filename: str | None = Field(None, description="Optional filename for download")


class DownloadUrlResponse(BaseModel):
    """Response containing download URL."""
    download_url: str = Field(..., description="URL for downloading the file")
    expires_in: int | None = Field(None, description="URL expiration (None if public)")


class DeleteFileRequest(BaseModel):
    """Request model for deleting a file."""
    file_key: str = Field(..., description="Storage key of the file to delete")


# ============ Endpoints ============

import uuid
import os
from fastapi import Request

# Resolve uploads directory relative to this file (portable, cross-platform)
_HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_UPLOADS_DIR = os.path.abspath(os.path.join(_HERE, "..", "..", "..", "..", "uploads"))

@router.post("/upload-url", response_model=UploadUrlResponse, status_code=status.HTTP_200_OK)
async def generate_upload_url(
    request: UploadUrlRequest,
    current_artist: Artist = Depends(get_current_artist),
    storage: StorageClient = Depends(get_storage_client)
):
    """
    Generate a presigned URL for direct browser upload.
    Supports Local Mock if S3 is not configured.
    """
    try:
        # Check if S3 is actually configured
        if not storage.config.access_key_id or storage.config.access_key_id == "":
            # LOCAL MOCK MODE
            unique_id = uuid.uuid4().hex[:8]
            # Keep filename filesystem-safe
            safe_name = os.path.basename(request.filename).replace(" ", "_")
            file_key = f"{request.category}/{current_artist.id}/{unique_id}_{safe_name}"
            # Return a URL that points back to our own API
            base_url = os.getenv("BACKEND_URL", "http://localhost:8000")
            upload_url = f"{base_url}/api/v1/storage/upload/{file_key}"
            file_url = f"{base_url}/api/v1/storage/local/{file_key}"

            if request.category == "tracks":
                allowed = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3", "audio/flac", "audio/ogg"]
            else:  # covers / avatars
                allowed = ["image/jpeg", "image/png", "image/webp"]

            return UploadUrlResponse(
                upload_url=upload_url,
                file_key=file_key,
                file_url=file_url,
                expires_in=3600,
                max_size_bytes=100 * 1024 * 1024,
                allowed_content_types=allowed
            )

        result = storage.generate_upload_url(
            category=request.category,
            artist_id=current_artist.id,
            filename=request.filename,
            content_type=request.content_type,
            track_id=request.track_id
        )
        
        return UploadUrlResponse(
            upload_url=result.upload_url,
            file_key=result.file_key,
            file_url=result.file_url,
            expires_in=result.expires_in,
            max_size_bytes=result.max_size_bytes,
            allowed_content_types=result.allowed_content_types
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service error: {str(e)}"
        )


@router.put("/upload/{category}/{artist_id}/{filename}")
async def local_file_upload(
    category: str,
    artist_id: int,
    filename: str,
    request: Request
):
    """Handle local file upload when S3 is not configured."""
    upload_dir = os.path.join(LOCAL_UPLOADS_DIR, category, str(artist_id))
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(await request.body())
    
    return {"status": "success", "file_path": file_path}

@router.get("/local/{category}/{artist_id}/{filename}")
async def serve_local_file(category: str, artist_id: int, filename: str):
    """Stream a locally stored file (audio playback, artwork, distribution)."""
    import mimetypes
    from fastapi.responses import FileResponse

    # Prevent path traversal
    safe_name = os.path.basename(filename)
    file_path = os.path.join(LOCAL_UPLOADS_DIR, category, str(artist_id), safe_name)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    media_type = mimetypes.guess_type(safe_name)[0] or "application/octet-stream"
    return FileResponse(file_path, media_type=media_type)


@router.post("/download-url", response_model=DownloadUrlResponse, status_code=status.HTTP_200_OK)
async def generate_download_url(
    request: DownloadUrlRequest,
    current_artist: Artist = Depends(get_current_artist),
    storage: StorageClient = Depends(get_storage_client)
):
    """
    Generate a presigned URL for downloading a file.
    
    If the storage is configured with a public CDN URL,
    this will return the public URL directly.
    """
    try:
        result = storage.generate_download_url(
            file_key=request.file_key,
            filename=request.filename
        )
        
        return DownloadUrlResponse(
            download_url=result.download_url,
            expires_in=result.expires_in
        )
    
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service error: {str(e)}"
        )


@router.delete("/file", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    request: DeleteFileRequest,
    current_artist: Artist = Depends(get_current_artist),
    storage: StorageClient = Depends(get_storage_client)
):
    """
    Delete a file from storage.
    
    Security: Only files belonging to the current artist can be deleted.
    The file_key must start with the artist's ID path.
    """
    # Security check: Ensure the file belongs to this artist
    valid_prefixes = [
        f"tracks/{current_artist.id}/",
        f"covers/{current_artist.id}/",
        f"avatars/{current_artist.id}/"
    ]
    
    if not any(request.file_key.startswith(prefix) for prefix in valid_prefixes):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own files"
        )
    
    try:
        storage.delete_file(request.file_key)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service error: {str(e)}"
        )
