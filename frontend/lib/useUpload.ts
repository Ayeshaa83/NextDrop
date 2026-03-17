'use client';

import { useState, useCallback } from 'react';
import { uploadTrack, uploadAlbumCover, uploadAvatar, UploadProgress, UploadResult, validateFile, FileCategory } from './storage';

interface UseUploadState {
  isUploading: boolean;
  progress: UploadProgress | null;
  result: UploadResult | null;
  error: string | null;
}

interface UseUploadReturn extends UseUploadState {
  upload: (file: File) => Promise<UploadResult>;
  reset: () => void;
}

/**
 * Hook for uploading track files with progress
 */
export function useTrackUpload(trackId?: number): UseUploadReturn {
  const [state, setState] = useState<UseUploadState>({
    isUploading: false,
    progress: null,
    result: null,
    error: null,
  });

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    // Validate before upload
    const validation = validateFile(file, 'tracks');
    if (!validation.valid) {
      const errorResult: UploadResult = {
        success: false,
        fileUrl: '',
        fileKey: '',
        error: validation.error,
      };
      setState(s => ({ ...s, error: validation.error || null, result: errorResult }));
      return errorResult;
    }

    setState({ isUploading: true, progress: null, result: null, error: null });

    const result = await uploadTrack(
      file,
      (progress) => setState(s => ({ ...s, progress })),
      trackId
    );

    setState({
      isUploading: false,
      progress: result.success ? { loaded: 100, total: 100, percentage: 100 } : null,
      result,
      error: result.error || null,
    });

    return result;
  }, [trackId]);

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: null, result: null, error: null });
  }, []);

  return { ...state, upload, reset };
}

/**
 * Hook for uploading album cover images with progress
 */
export function useCoverUpload(): UseUploadReturn {
  const [state, setState] = useState<UseUploadState>({
    isUploading: false,
    progress: null,
    result: null,
    error: null,
  });

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    const validation = validateFile(file, 'covers');
    if (!validation.valid) {
      const errorResult: UploadResult = {
        success: false,
        fileUrl: '',
        fileKey: '',
        error: validation.error,
      };
      setState(s => ({ ...s, error: validation.error || null, result: errorResult }));
      return errorResult;
    }

    setState({ isUploading: true, progress: null, result: null, error: null });

    const result = await uploadAlbumCover(
      file,
      (progress) => setState(s => ({ ...s, progress }))
    );

    setState({
      isUploading: false,
      progress: result.success ? { loaded: 100, total: 100, percentage: 100 } : null,
      result,
      error: result.error || null,
    });

    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: null, result: null, error: null });
  }, []);

  return { ...state, upload, reset };
}

/**
 * Hook for uploading profile avatars with progress
 */
export function useAvatarUpload(): UseUploadReturn {
  const [state, setState] = useState<UseUploadState>({
    isUploading: false,
    progress: null,
    result: null,
    error: null,
  });

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    const validation = validateFile(file, 'avatars');
    if (!validation.valid) {
      const errorResult: UploadResult = {
        success: false,
        fileUrl: '',
        fileKey: '',
        error: validation.error,
      };
      setState(s => ({ ...s, error: validation.error || null, result: errorResult }));
      return errorResult;
    }

    setState({ isUploading: true, progress: null, result: null, error: null });

    const result = await uploadAvatar(
      file,
      (progress) => setState(s => ({ ...s, progress }))
    );

    setState({
      isUploading: false,
      progress: result.success ? { loaded: 100, total: 100, percentage: 100 } : null,
      result,
      error: result.error || null,
    });

    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: null, result: null, error: null });
  }, []);

  return { ...state, upload, reset };
}

/**
 * Generic upload hook for any file category
 */
export function useFileUpload(category: FileCategory): UseUploadReturn {
  const [state, setState] = useState<UseUploadState>({
    isUploading: false,
    progress: null,
    result: null,
    error: null,
  });

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    const validation = validateFile(file, category);
    if (!validation.valid) {
      const errorResult: UploadResult = {
        success: false,
        fileUrl: '',
        fileKey: '',
        error: validation.error,
      };
      setState(s => ({ ...s, error: validation.error || null, result: errorResult }));
      return errorResult;
    }

    setState({ isUploading: true, progress: null, result: null, error: null });

    let uploadFn: typeof uploadTrack;
    switch (category) {
      case 'tracks':
        uploadFn = uploadTrack;
        break;
      case 'covers':
        uploadFn = uploadAlbumCover;
        break;
      case 'avatars':
        uploadFn = uploadAvatar;
        break;
    }

    const result = await uploadFn(
      file,
      (progress) => setState(s => ({ ...s, progress }))
    );

    setState({
      isUploading: false,
      progress: result.success ? { loaded: 100, total: 100, percentage: 100 } : null,
      result,
      error: result.error || null,
    });

    return result;
  }, [category]);

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: null, result: null, error: null });
  }, []);

  return { ...state, upload, reset };
}
