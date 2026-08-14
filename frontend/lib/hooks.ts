'use client';

import { useState, useEffect, useCallback } from 'react';
import { tracksApi, albumsApi, analyticsApi, socialApi, artistApi, adminApi, feedApi, earningsApi, notificationsApi, ApiError, Track, Album, DashboardData, TrackAnalytics, LeaderboardEntry, Artist, Collaboration, AdminStats, PendingTrack, SocialPost, PostType } from './api';
import type { ArtistPublicProfile, PublicTrack, PaginatedResponse } from './api';

// Generic data fetching hook
function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Distinguishes "your session is gone" from "the request failed" — a 401
  // here means the page rendered before (or instead of) useRequireAuth's
  // redirect kicking in, not that the underlying data is actually empty.
  const [isAuthError, setIsAuthError] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsAuthError(false);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setIsAuthError(err instanceof ApiError && err.status === 401);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, isAuthError, refetch };
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

export function useTimeseries(days = 30) {
  return useApiData(() => analyticsApi.getTimeseries(days), [days]);
}

export function useTerritories() {
  return useApiData(() => analyticsApi.getTerritories(), []);
}

// ============ SOCIAL HOOKS ============

export function useLeaderboard(category?: string) {
  return useApiData(() => socialApi.getLeaderboard(category), [category]);
}

export function useLeaderboardCategories() {
  return useApiData(() => socialApi.getLeaderboardCategories(), []);
}

export function useMyLeaderboardPosition(category?: string) {
  return useApiData(() => socialApi.getMyLeaderboardPosition(category), [category]);
}

export function useMyCollaborations() {
  return useApiData(() => socialApi.getMyCollaborations(), []);
}

export function usePendingCollaborations() {
  return useApiData(() => socialApi.getPendingCollaborations(), []);
}

export function useCollabUnreadCount(intervalMs = 20000) {
  const [count, setCount] = useState(0);
  const fetchCount = useCallback(async () => {
    try {
      const { unread_count } = await socialApi.getCollabUnreadCount();
      setCount(unread_count);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, intervalMs);
    return () => clearInterval(id);
  }, [fetchCount, intervalMs]);

  return { count, refetch: fetchCount };
}

// ============ ARTIST HOOKS ============

export function useAllArtists() {
  return useApiData<PaginatedResponse<ArtistPublicProfile>>(() => artistApi.listArtists(0, 100), []);
}

export function useArtist(artistId: number) {
  return useApiData<ArtistPublicProfile>(() => artistApi.getArtist(artistId), [artistId]);
}

export function useArtistTracks(artistId: number) {
  return useApiData<PaginatedResponse<PublicTrack>>(() => artistApi.getArtistTracks(artistId), [artistId]);
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

// ============ EARNINGS HOOKS ============

export function useWallet() {
  return useApiData(() => earningsApi.getWallet(), []);
}

export function useEarningsSummary() {
  return useApiData(() => earningsApi.getSummary(), []);
}

export function usePayoutHistory() {
  return useApiData(() => earningsApi.getPayouts(), []);
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

export function useAdminPayouts(statusFilter?: string) {
  return useApiData(() => adminApi.getPayouts(0, 50, statusFilter), [statusFilter]);
}

export function useAdminArtists() {
  return useApiData(() => adminApi.getArtists(), []);
}

export function usePlatformAnalytics(days = 30) {
  return useApiData(() => adminApi.getPlatformAnalytics(days), [days]);
}

export function usePlatformConfigs() {
  return useApiData(() => adminApi.getPlatformConfigs(), []);
}

// ============ FEED HOOKS (JAM JAR / OPEN VERSE) ============

export function useFeed(postType?: PostType, skip = 0, limit = 20) {
  return useApiData(
    () => feedApi.getFeed(skip, limit, postType),
    [postType, skip, limit]
  );
}

export function usePost(postId: number) {
  return useApiData(() => feedApi.getPost(postId), [postId]);
}

// ============ NOTIFICATION HOOKS ============

// Polls the unread count so the bell badge updates without a page reload.
export function useUnreadNotificationCount(intervalMs = 20000) {
  const [count, setCount] = useState(0);

  const refetch = useCallback(async () => {
    try {
      const { unread_count } = await notificationsApi.getUnreadCount();
      setCount(unread_count);
    } catch {
      // Silently ignore — polling will retry
    }
  }, []);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, intervalMs);
    return () => clearInterval(id);
  }, [refetch, intervalMs]);

  return { count, refetch };
}

export function useNotifications() {
  return useApiData(() => notificationsApi.getAll(0, 20), []);
}
