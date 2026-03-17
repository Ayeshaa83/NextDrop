'use client';

import { useState, useEffect, useCallback } from 'react';
import { tracksApi, albumsApi, analyticsApi, socialApi, artistApi, adminApi, feedApi, Track, Album, DashboardData, TrackAnalytics, LeaderboardEntry, Artist, Collaboration, AdminStats, PendingTrack, SocialPost, PostType } from './api';

// Generic data fetching hook
function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ============ TRACK HOOKS ============

export function useMyTracks() {
  return useApiData(() => tracksApi.getMyTracks(), []);
}

export function usePublicTracks() {
  return useApiData(() => tracksApi.getPublicTracks(), []);
}

export function useTrack(trackId: number) {
  return useApiData(() => tracksApi.getTrack(trackId), [trackId]);
}

// ============ ALBUM HOOKS ============

export function useMyAlbums() {
  return useApiData(() => albumsApi.getMyAlbums(), []);
}

export function useAlbum(albumId: number) {
  return useApiData(() => albumsApi.getAlbum(albumId), [albumId]);
}

export function useAlbumTracks(albumId: number) {
  return useApiData(() => albumsApi.getAlbumTracks(albumId), [albumId]);
}

// ============ ANALYTICS HOOKS ============

export function useDashboard() {
  return useApiData(() => analyticsApi.getDashboard(), []);
}

export function useTrackAnalytics(trackId: number) {
  return useApiData(() => analyticsApi.getTrackAnalytics(trackId), [trackId]);
}

export function useRevenuePrediction() {
  return useApiData(() => analyticsApi.getRevenuePrediction(), []);
}

// ============ SOCIAL HOOKS ============

export function useLeaderboard(category?: string) {
  return useApiData(() => socialApi.getLeaderboard(category), [category]);
}

export function useMyCollaborations() {
  return useApiData(() => socialApi.getMyCollaborations(), []);
}

export function usePendingCollaborations() {
  return useApiData(() => socialApi.getPendingCollaborations(), []);
}

// ============ ARTIST HOOKS ============

export function useAllArtists() {
  return useApiData(() => artistApi.listArtists(), []);
}

export function useArtist(artistId: number) {
  return useApiData(() => artistApi.getArtist(artistId), [artistId]);
}

// ============ COMBINED DATA HOOKS ============

export function useMusicLibrary() {
  const tracks = useMyTracks();
  const albums = useMyAlbums();

  return {
    tracks: tracks.data || [],
    albums: albums.data || [],
    loading: tracks.loading || albums.loading,
    error: tracks.error || albums.error,
    refetchTracks: tracks.refetch,
    refetchAlbums: albums.refetch,
  };
}

export function useAnalyticsDashboard() {
  const dashboard = useDashboard();
  const revenue = useRevenuePrediction();

  return {
    dashboard: dashboard.data,
    revenue: revenue.data,
    loading: dashboard.loading || revenue.loading,
    error: dashboard.error || revenue.error,
    refetch: () => {
      dashboard.refetch();
      revenue.refetch();
    },
  };
}

// Format helpers
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============ ADMIN HOOKS ============

export function useAdminStats() {
  return useApiData(() => adminApi.getStats(), []);
}

export function usePendingTracks() {
  return useApiData(() => adminApi.getPendingTracks(), []);
}

export function useAllTracksAdmin(statusFilter?: string) {
  return useApiData(() => adminApi.getAllTracks(0, 50, statusFilter), [statusFilter]);
}

export function useAllUsersAdmin(roleFilter?: string) {
  return useApiData(() => adminApi.getAllUsers(0, 50, roleFilter), [roleFilter]);
}

// ============ FEED HOOKS (JAM JAR / OPEN VERSE) ============

export function useFeed(postType?: PostType, skip = 0, limit = 20) {
  return useApiData(
    () => feedApi.getFeed(skip, limit, postType),
    [postType, skip, limit]
  );
}

export function useSnippetFeed(skip = 0, limit = 20) {
  return useFeed('snippet', skip, limit);
}

export function useOpenVerseFeed(skip = 0, limit = 20) {
  return useFeed('open_verse', skip, limit);
}

export function usePost(postId: number) {
  return useApiData(() => feedApi.getPost(postId), [postId]);
}
