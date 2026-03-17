/**
 * NextDrop Storage Utilities
 * 
 * Handles direct browser uploads to cloud storage using presigned URLs.
 * This bypasses the server for large file uploads, saving memory and bandwidth.
 */

import { storageApi } from './api';

export type FileCategory = 'tracks' | 'covers' | 'avatars';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  fileUrl: string;
  fileKey: string;
  error?: string;
}

/**
 * Upload a file directly to cloud storage using presigned URL
 * 
 * @param file - The file to upload
 * @param category - File category (tracks, covers, avatars)
 * @param onProgress - Optional progress callback
 * @param trackId - Optional track ID for track files
 * @returns Upload result with final file URL
 */
export async function uploadFile(
  file: File,
  category: FileCategory,
  onProgress?: (progress: UploadProgress) => void,
  trackId?: number
): Promise<UploadResult> {
  try {
    // Step 1: Get presigned URL from backend
    const presigned = await storageApi.getUploadUrl({
      filename: file.name,
      content_type: file.type,
      category,
      track_id: trackId,
    });

    // Validate file size
    if (file.size > presigned.max_size_bytes) {
      const maxMB = Math.round(presigned.max_size_bytes / 1024 / 1024);
      return {
        success: false,
        fileUrl: '',
        fileKey: '',
        error: `File too large. Maximum size is ${maxMB}MB`,
      };
    }

    // Validate content type
    if (!presigned.allowed_content_types.includes(file.type)) {
      return {
        success: false,
        fileUrl: '',
        fileKey: '',
        error: `Invalid file type. Allowed: ${presigned.allowed_content_types.join(', ')}`,
      };
    }

    // Step 2: Upload directly to storage using presigned URL
    await uploadToPresignedUrl(presigned.upload_url, file, file.type, onProgress);

    return {
      success: true,
      fileUrl: presigned.file_url,
      fileKey: presigned.file_key,
    };
  } catch (error) {
    return {
      success: false,
      fileUrl: '',
      fileKey: '',
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload file to presigned URL with progress tracking
 */
async function uploadToPresignedUrl(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

/**
 * Upload a track file
 */
export async function uploadTrack(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  trackId?: number
): Promise<UploadResult> {
  return uploadFile(file, 'tracks', onProgress, trackId);
}

/**
 * Upload an album cover image
 */
export async function uploadAlbumCover(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return uploadFile(file, 'covers', onProgress);
}

/**
 * Upload a profile avatar
 */
export async function uploadAvatar(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return uploadFile(file, 'avatars', onProgress);
}

/**
 * Delete a file from storage
 */
export async function deleteFile(fileKey: string): Promise<boolean> {
  try {
    await storageApi.deleteFile({ file_key: fileKey });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a download URL for a file
 */
export async function getDownloadUrl(fileKey: string, filename?: string): Promise<string> {
  const result = await storageApi.getDownloadUrl({ file_key: fileKey, filename });
  return result.download_url;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  category: FileCategory
): { valid: boolean; error?: string } {
  const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg'];
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  const maxAudioSize = 100 * 1024 * 1024; // 100MB
  const maxImageSize = 10 * 1024 * 1024;  // 10MB

  if (category === 'tracks') {
    if (!audioTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid audio format. Accepted: MP3, WAV, FLAC, AAC, OGG' };
    }
    if (file.size > maxAudioSize) {
      return { valid: false, error: 'Audio file too large. Maximum is 100MB' };
    }
  } else {
    if (!imageTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid image format. Accepted: JPEG, PNG, WebP, GIF' };
    }
    if (file.size > maxImageSize) {
      return { valid: false, error: 'Image file too large. Maximum is 10MB' };
    }
  }

  return { valid: true };
}
