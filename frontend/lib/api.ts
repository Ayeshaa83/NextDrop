/**
 * NextDrop API Service Layer
 * Handles all communication with the FastAPI backend
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Paginated response type (matches backend PaginatedResponse)
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

// User roles (matches backend UserRole enum)
export type UserRole = 'user' | 'artist' | 'admin';

// Types
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_premium: boolean;
  role: UserRole;
}

export interface Artist {
  id: number;
  user_id: number;
  stage_name: string;
  bio: string | null;
  profile_picture: string | null;
  is_verified?: boolean;
  approval_status?: 'pending' | 'approved' | 'rejected';
}

// Public artist card/profile — Explore directory + artist detail page.
// Only ever built from approved artists (backend never returns pending/rejected here).
export interface ArtistPublicProfile {
  id: number;
  user_id: number;
  stage_name: string;
  bio: string | null;
  profile_picture: string | null;
  is_verified: boolean;
  rank: number;
  track_count: number;
  total_streams: number;
}

export interface PublicTrack {
  id: number;
  title: string;
  duration: number;
  file_url: string;
  cover_art_url: string | null;
  genre: string | null;
  bpm: number | null;
  is_explicit: boolean;
  created_at: string | null;
  stream_count: number;
}

export interface Track {
  id: number;
  artist_id: number;
  title: string;
  duration: number;
  file_url: string;
  genre: string | null;
  bpm: number | null;
  cover_art_url?: string | null;
  is_public: boolean;
  isrc?: string | null;
  is_explicit?: boolean;
  release_date?: string | null;
  approval_status?: string | null;
  approval_notes?: string | null;
  created_at?: string | null;
  processing_status?: string;
  ai_analysis?: AIAnalysisResponse | null;
}

export interface CollaboratorInput {
  name: string;
  role?: string;
  royalty_percentage: number;
}

export interface TrackCreatePayload {
  title: string;
  duration: number;
  file_url: string;
  cover_art_url?: string | null;
  genre?: string | null;
  bpm?: number | null;
  is_public?: boolean;
  isrc?: string | null;
  is_explicit?: boolean;
  release_date?: string | null;
  collaborators?: CollaboratorInput[];
}

export interface TrackProcessingStatus {
  id: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error: string | null;
}

export interface AIAnalysisResponse {
  features: Record<string, number | boolean>;
  hit_score: number;
  predicted_genre: string;
  genre_confidence?: number;
  hit_factors: Record<string, string | number>;
}

export interface Album {
  id: number;
  artist_id: number;
  title: string;
  cover_art_url: string | null;
  release_date: string;
}

export interface TrackAnalytics {
  id: number;
  track_id: number;
  stream_count: number;
  save_count: number;
  share_count: number;
  hit_score: number | null;
  viral_velocity: number | null;
  sentiment_data: Record<string, number> | null;
  last_updated: string;
  // Per-platform — kept separate since YouTube and Spotify measure
  // genuinely different things (see track detail page).
  youtube_views: number;
  youtube_likes: number;
  youtube_comments: number;
  spotify_popularity: number | null;
}

export interface DashboardData {
  total_streams: number;
  total_saves: number;
  total_shares: number;
  average_hit_score: number | null;
  top_track_id: number | null;
  monthly_revenue_prediction: number | null;
  platform_breakdown?: Record<string, number>;
}

export interface RevenuePrediction {
  id: number;
  artist_id: number;
  predicted_monthly_revenue: number;
  confidence_interval: number;
  calculation_date: string;
}

export interface CollabArtistSummary {
  id: number;
  stage_name: string;
  profile_picture: string | null;
  is_verified: boolean;
}

export interface Collaboration {
  id: number;
  initiator_id: number;
  collaborator_id: number;
  track_id: number | null;
  status: 'pending' | 'accepted' | 'completed' | 'rejected';
  message: string | null;
  created_at: string;
  initiator: CollabArtistSummary | null;
  collaborator: CollabArtistSummary | null;
  track_title: string | null;
  unread_count: number;
}

export interface CollabMessage {
  id: number;
  collaboration_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  is_mine: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  artist_id: number;
  stage_name: string;
  points: number;
  profile_picture: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// API Error class
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic fetch wrapper with HttpOnly cookie support
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send HttpOnly cookies with every request
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, errorData.detail || 'Request failed');
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============ AUTH API ============

export const authApi = {
  async signup(email: string, password: string): Promise<User> {
    return apiFetch<User>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async login(email: string, password: string, rememberMe = false): Promise<LoginResponse> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    formData.append('remember_me', String(rememberMe));

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login/access-token`, {
      method: 'POST',
      credentials: 'include', // Receive and store HttpOnly cookie
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new ApiError(response.status, errorData.detail || 'Login failed');
    }

    return response.json();
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  async getCurrentUser(): Promise<User> {
    return apiFetch<User>('/api/v1/auth/me');
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  },

  /** Kicks off "Sign in with Google" — redirects the browser to Google's consent screen. */
  async loginWithGoogle(): Promise<void> {
    const { auth_url } = await apiFetch<{ auth_url: string }>('/api/v1/auth/google/login');
    window.location.href = auth_url;
  },
};

// ============ ARTIST API ============

export const artistApi = {
  async getMyProfile(): Promise<Artist | null> {
    return apiFetch<Artist | null>('/api/v1/artists/me');
  },

  async createProfile(data: { stage_name: string; bio?: string; profile_picture?: string }): Promise<Artist> {
    return apiFetch<Artist>('/api/v1/artists/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProfile(data: Partial<Artist>): Promise<Artist> {
    return apiFetch<Artist>('/api/v1/artists/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getArtist(artistId: number): Promise<ArtistPublicProfile> {
    return apiFetch<ArtistPublicProfile>(`/api/v1/artists/${artistId}`);
  },

  async listArtists(skip = 0, limit = 50): Promise<PaginatedResponse<ArtistPublicProfile>> {
    return apiFetch<PaginatedResponse<ArtistPublicProfile>>(`/api/v1/artists/?skip=${skip}&limit=${limit}`);
  },

  async getArtistTracks(artistId: number, skip = 0, limit = 50): Promise<PaginatedResponse<PublicTrack>> {
    return apiFetch<PaginatedResponse<PublicTrack>>(`/api/v1/artists/${artistId}/tracks?skip=${skip}&limit=${limit}`);
  },
};

// ============ TRACKS API ============

export const tracksApi = {
  async getMyTracks(skip = 0, limit = 100): Promise<PaginatedResponse<Track>> {
    return apiFetch<PaginatedResponse<Track>>(`/api/v1/tracks/?skip=${skip}&limit=${limit}`);
  },

  async getPublicTracks(skip = 0, limit = 100): Promise<PaginatedResponse<Track>> {
    return apiFetch<PaginatedResponse<Track>>(`/api/v1/tracks/public?skip=${skip}&limit=${limit}`);
  },

  async getTrack(trackId: number): Promise<Track> {
    return apiFetch<Track>(`/api/v1/tracks/${trackId}`);
  },

  async createTrack(data: TrackCreatePayload): Promise<Track> {
    return apiFetch<Track>('/api/v1/tracks/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTrack(trackId: number, data: Partial<Track>): Promise<Track> {
    return apiFetch<Track>(`/api/v1/tracks/${trackId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTrack(trackId: number): Promise<void> {
    return apiFetch<void>(`/api/v1/tracks/${trackId}`, {
      method: 'DELETE',
    });
  },

  async unpublishTrack(trackId: number): Promise<UnpublishResult> {
    return apiFetch<UnpublishResult>(`/api/v1/tracks/${trackId}/unpublish`, {
      method: 'POST',
    });
  },
};

export interface UnpublishResult {
  track: Track;
  platforms: { platform: string; success: boolean; error: string | null }[];
  outcome: 'unpublished' | 'already_unpublished' | 'not_published';
}

// ============ ALBUMS API ============

export const albumsApi = {
  async getMyAlbums(skip = 0, limit = 50): Promise<PaginatedResponse<Album>> {
    return apiFetch<PaginatedResponse<Album>>(`/api/v1/albums/?skip=${skip}&limit=${limit}`);
  },

  async getAlbum(albumId: number): Promise<Album> {
    return apiFetch<Album>(`/api/v1/albums/${albumId}`);
  },

  async createAlbum(data: { title: string; cover_art_url?: string }): Promise<Album> {
    return apiFetch<Album>('/api/v1/albums/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async addTrackToAlbum(albumId: number, trackId: number, position: number): Promise<void> {
    return apiFetch<void>(`/api/v1/albums/${albumId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId, position }),
    });
  },

  async getAlbumTracks(albumId: number): Promise<{ album_id: number; album_title: string; tracks: Array<{ id: number; title: string; duration: number; position: number }> }> {
    return apiFetch(`/api/v1/albums/${albumId}/tracks`);
  },

  async deleteAlbum(albumId: number): Promise<void> {
    return apiFetch<void>(`/api/v1/albums/${albumId}`, {
      method: 'DELETE',
    });
  },
};

// ============ ANALYTICS API ============

export const analyticsApi = {
  async getTrackAnalytics(trackId: number): Promise<TrackAnalytics> {
    return apiFetch<TrackAnalytics>(`/api/v1/analytics/tracks/${trackId}`);
  },

  async getDashboard(): Promise<DashboardData> {
    return apiFetch<DashboardData>('/api/v1/analytics/dashboard');
  },

  async getRevenuePrediction(): Promise<RevenuePrediction> {
    return apiFetch<RevenuePrediction>('/api/v1/analytics/revenue');
  },

  async simulateActivity(trackId: number, streams = 1000, saves = 50, shares = 25): Promise<{ message: string; track_id: number; new_hit_score: number; new_viral_velocity: number; total_streams: number }> {
    return apiFetch(`/api/v1/analytics/tracks/${trackId}/simulate?streams=${streams}&saves=${saves}&shares=${shares}`, {
      method: 'POST',
    });
  },

  async getTimeseries(days = 30): Promise<TimeseriesData> {
    return apiFetch<TimeseriesData>(`/api/v1/analytics/timeseries?days=${days}`);
  },

  async getTerritories(): Promise<TerritoriesData> {
    return apiFetch<TerritoriesData>('/api/v1/analytics/territories');
  },

  async refreshPlatforms(trackId: number): Promise<TrackAnalytics> {
    return apiFetch<TrackAnalytics>(`/api/v1/analytics/tracks/${trackId}/refresh-platforms`, {
      method: 'POST',
    });
  },
};

export interface TimeseriesPoint {
  date: string;
  total: number;
  youtube?: number;
  spotify?: number;
  other?: number;
}

export interface TimeseriesData {
  days: number;
  points: TimeseriesPoint[];
}

export interface TerritoryStat {
  country: string;
  streams: number;
  previous_streams: number;
  growth_percentage: number;
}

export interface TerritoriesData {
  territories: TerritoryStat[];
}

// ============ SOCIAL API ============

export const socialApi = {
  async createCollaboration(data: { collaborator_id: number; track_id?: number; message?: string }): Promise<Collaboration> {
    return apiFetch<Collaboration>('/api/v1/social/collaborate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyCollaborations(skip = 0, limit = 50): Promise<PaginatedResponse<Collaboration>> {
    return apiFetch<PaginatedResponse<Collaboration>>(`/api/v1/social/collaborations?skip=${skip}&limit=${limit}`);
  },

  async getPendingCollaborations(skip = 0, limit = 50): Promise<PaginatedResponse<Collaboration>> {
    return apiFetch<PaginatedResponse<Collaboration>>(`/api/v1/social/collaborations/pending?skip=${skip}&limit=${limit}`);
  },

  async respondToCollaboration(collabId: number, status: 'accepted' | 'rejected' | 'completed'): Promise<Collaboration> {
    return apiFetch<Collaboration>(`/api/v1/social/collaborations/${collabId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async addTrackToCollaboration(collabId: number, trackId: number): Promise<Collaboration> {
    return apiFetch<Collaboration>(`/api/v1/social/collaborations/${collabId}/track`, {
      method: 'PUT',
      body: JSON.stringify({ track_id: trackId }),
    });
  },

  async getCollabUnreadCount(): Promise<{ unread_count: number }> {
    return apiFetch<{ unread_count: number }>('/api/v1/social/collaborations/unread-count');
  },

  async getCollabMessages(collabId: number, skip = 0, limit = 100): Promise<PaginatedResponse<CollabMessage>> {
    return apiFetch<PaginatedResponse<CollabMessage>>(`/api/v1/social/collaborations/${collabId}/messages?skip=${skip}&limit=${limit}`);
  },

  async sendCollabMessage(collabId: number, content: string): Promise<CollabMessage> {
    return apiFetch<CollabMessage>(`/api/v1/social/collaborations/${collabId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async getLeaderboard(category?: string, skip = 0, limit = 50): Promise<PaginatedResponse<LeaderboardEntry>> {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (category) params.append('category', category);
    return apiFetch<PaginatedResponse<LeaderboardEntry>>(`/api/v1/social/leaderboard?${params}`);
  },

  async getLeaderboardCategories(): Promise<{ categories: string[] }> {
    return apiFetch<{ categories: string[] }>('/api/v1/social/leaderboard/categories');
  },

  async getMyLeaderboardPosition(category?: string): Promise<MyLeaderboardPosition> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiFetch<MyLeaderboardPosition>(`/api/v1/social/leaderboard/me${params}`);
  },
};

export interface MyLeaderboardPosition {
  ranked: boolean;
  rank?: number;
  points?: number;
  category?: string;
  total_artists: number;
}
// ============ STORAGE API ============

export interface UploadUrlRequest {
  filename: string;
  content_type?: string;
  category: 'tracks' | 'covers' | 'avatars';
  track_id?: number;
}

export interface UploadUrlResponse {
  upload_url: string;
  file_key: string;
  file_url: string;
  expires_in: number;
  max_size_bytes: number;
  allowed_content_types: string[];
}

export interface DownloadUrlRequest {
  file_key: string;
  filename?: string;
}

export interface DownloadUrlResponse {
  download_url: string;
  expires_in: number | null;
}

export interface DeleteFileRequest {
  file_key: string;
}

export const storageApi = {
  async getUploadUrl(data: UploadUrlRequest): Promise<UploadUrlResponse> {
    return apiFetch<UploadUrlResponse>('/api/v1/storage/upload-url', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getDownloadUrl(data: DownloadUrlRequest): Promise<DownloadUrlResponse> {
    return apiFetch<DownloadUrlResponse>('/api/v1/storage/download-url', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteFile(data: DeleteFileRequest): Promise<void> {
    return apiFetch<void>('/api/v1/storage/file', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  },

  /**
   * Full upload flow: request a presigned URL, then PUT the file to it.
   * Works both in local-mock mode and against S3/R2.
   * Returns the permanent file_url to store on the track.
   */
  async uploadFile(file: File, category: 'tracks' | 'covers' | 'avatars', trackId?: number): Promise<{ file_key: string; file_url: string }> {
    const presign = await this.getUploadUrl({
      filename: file.name,
      content_type: file.type || undefined,
      category,
      track_id: trackId,
    });

    const res = await fetch(presign.upload_url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    if (!res.ok) {
      throw new ApiError(res.status, 'File upload failed');
    }

    return { file_key: presign.file_key, file_url: presign.file_url };
  },
};

// ============ ADMIN API ============

export interface AdminStats {
  total_users: number;
  total_artists: number;
  total_tracks: number;
  pending_approvals: number;
  approved_tracks: number;
  rejected_tracks: number;
}

export interface PendingTrack {
  id: number;
  title: string;
  artist_id: number;
  artist_name: string | null;
  file_url: string;
  genre: string | null;
  bpm: number | null;
  duration: number | null;
  quality_score?: number | null;
  approval_status: string;
  approval_notes: string | null;
  approved_by_id: number | null;
  approved_at: string | null;
  created_at: string | null;
}

export interface ApprovalAction {
  status: 'approved' | 'rejected';
  notes?: string;
}

export const adminApi = {
  async getStats(): Promise<AdminStats> {
    return apiFetch<AdminStats>('/api/v1/admin/stats');
  },

  async getPendingTracks(skip = 0, limit = 50): Promise<PaginatedResponse<PendingTrack>> {
    return apiFetch<PaginatedResponse<PendingTrack>>(`/api/v1/admin/tracks/pending?skip=${skip}&limit=${limit}`);
  },

  async getAllTracks(skip = 0, limit = 50, status?: string): Promise<PaginatedResponse<PendingTrack>> {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (status) params.append('status_filter', status);
    return apiFetch<PaginatedResponse<PendingTrack>>(`/api/v1/admin/tracks/all?${params}`);
  },

  async approveTrack(trackId: number, action: ApprovalAction): Promise<PendingTrack> {
    return apiFetch<PendingTrack>(`/api/v1/admin/tracks/${trackId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(action),
    });
  },

  async markUnderReview(trackId: number): Promise<PendingTrack> {
    return apiFetch<PendingTrack>(`/api/v1/admin/tracks/${trackId}/review`, {
      method: 'PUT',
    });
  },

  async getAllUsers(skip = 0, limit = 50, role?: string): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (role) params.append('role_filter', role);
    return apiFetch<PaginatedResponse<any>>(`/api/v1/admin/users?${params}`);
  },

  async updateUserRole(userId: number, role: UserRole): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/v1/admin/users/${userId}/role?role=${role}`, {
      method: 'PUT',
    });
  },

  async getPayouts(skip = 0, limit = 50, status?: string): Promise<PaginatedResponse<AdminPayout>> {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (status) params.append('status_filter', status);
    return apiFetch<PaginatedResponse<AdminPayout>>(`/api/v1/admin/payouts?${params}`);
  },

  async updatePayoutStatus(payoutId: number, newStatus: 'completed' | 'rejected'): Promise<AdminPayout> {
    return apiFetch<AdminPayout>(`/api/v1/admin/payouts/${payoutId}/status?new_status=${newStatus}`, {
      method: 'PUT',
    });
  },

  async getArtists(skip = 0, limit = 50): Promise<PaginatedResponse<AdminArtist>> {
    return apiFetch<PaginatedResponse<AdminArtist>>(`/api/v1/admin/artists?skip=${skip}&limit=${limit}`);
  },

  async setArtistVerification(artistId: number, verified: boolean): Promise<AdminArtist> {
    return apiFetch<AdminArtist>(`/api/v1/admin/artists/${artistId}/verify?verified=${verified}`, {
      method: 'PUT',
    });
  },

  async setArtistApproval(artistId: number, approval: 'approved' | 'rejected', notes?: string): Promise<AdminArtist> {
    const params = new URLSearchParams({ approval });
    if (notes) params.append('notes', notes);
    return apiFetch<AdminArtist>(`/api/v1/admin/artists/${artistId}/approval?${params}`, {
      method: 'PUT',
    });
  },

  async getPlatformConfigs(): Promise<PlatformConfig[]> {
    return apiFetch<PlatformConfig[]>('/api/v1/admin/platforms');
  },

  async createPlatformConfig(data: PlatformConfigInput): Promise<PlatformConfig> {
    return apiFetch<PlatformConfig>('/api/v1/admin/platforms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePlatformConfig(configId: number, data: PlatformConfigInput): Promise<PlatformConfig> {
    return apiFetch<PlatformConfig>(`/api/v1/admin/platforms/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deletePlatformConfig(configId: number): Promise<void> {
    return apiFetch<void>(`/api/v1/admin/platforms/${configId}`, {
      method: 'DELETE',
    });
  },

  async getPlatformAnalytics(days = 30): Promise<PlatformAnalytics> {
    return apiFetch<PlatformAnalytics>(`/api/v1/admin/analytics?days=${days}`);
  },
};

export interface AdminPayout {
  id: number;
  user_id: number;
  user_email: string | null;
  amount: number;
  method: string;
  status: 'processing' | 'completed' | 'rejected';
  reference: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface AdminArtist {
  id: number;
  user_id: number;
  stage_name: string;
  user_email: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  approval_reviewed_at: string | null;
  is_verified: boolean;
  verified_at: string | null;
  track_count: number;
}

export interface PlatformConfig {
  id: number;
  platform_id: string;
  display_name: string;
  description: string;
  color: string;
  category: 'music' | 'video' | 'social';
  enabled: boolean;
  has_adapter: boolean;
}

export interface PlatformConfigInput {
  platform_id: string;
  display_name: string;
  description?: string;
  color?: string;
  category?: string;
  enabled?: boolean;
}

export interface PlatformAnalyticsPoint {
  date: string;
  signups: number;
  uploads: number;
}

export interface PlatformAnalytics {
  days: number;
  points: PlatformAnalyticsPoint[];
  approval_funnel: Record<string, number>;
}

// ============ SPOTIFY OAUTH API ============

export interface SpotifyAuthUrl {
  auth_url: string;
}

export interface SpotifyConnectionStatus {
  connected: boolean;
  provider: string;
  display_name: string | null;
  profile_image_url: string | null;
  provider_user_id: string | null;
  expires_at: string | null;
}

export interface SpotifyTopItem {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SpotifyTopItemsResponse {
  items: SpotifyTopItem[];
  total: number;
}

export const spotifyApi = {
  async getLoginUrl(): Promise<SpotifyAuthUrl> {
    return apiFetch<SpotifyAuthUrl>('/api/v1/spotify/login');
  },

  async getStatus(): Promise<SpotifyConnectionStatus> {
    return apiFetch<SpotifyConnectionStatus>('/api/v1/spotify/status');
  },

  async refreshToken(): Promise<{ message: string; expires_at: string }> {
    return apiFetch<{ message: string; expires_at: string }>('/api/v1/spotify/refresh', {
      method: 'POST',
    });
  },

  async disconnect(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/v1/spotify/disconnect', {
      method: 'DELETE',
    });
  },

  async getTopTracks(limit = 20, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term'): Promise<SpotifyTopItemsResponse> {
    return apiFetch<SpotifyTopItemsResponse>(`/api/v1/spotify/top-tracks?limit=${limit}&time_range=${timeRange}`);
  },

  async getTopArtists(limit = 20, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term'): Promise<SpotifyTopItemsResponse> {
    return apiFetch<SpotifyTopItemsResponse>(`/api/v1/spotify/top-artists?limit=${limit}&time_range=${timeRange}`);
  },
};

// ============ YOUTUBE OAUTH API ============

export interface YouTubeAuthUrl {
  auth_url: string;
}

export interface YouTubeConnectionStatus {
  connected: boolean;
  provider: string;
  channel_id: string | null;
  channel_title: string | null;
  thumbnail_url: string | null;
  expires_at: string | null;
}

export interface YouTubeChannelStats {
  channel_id: string;
  channel_title: string;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  video_count: number | null;
  view_count: number | null;
}

export interface YouTubeVideo {
  video_id: string;
  title: string;
  description: string | null;
  published_at: string;
  thumbnail_url: string | null;
}

export interface YouTubeVideosResponse {
  items: YouTubeVideo[];
  total: number;
}

export const youtubeApi = {
  async getLoginUrl(): Promise<YouTubeAuthUrl> {
    return apiFetch<YouTubeAuthUrl>('/api/v1/youtube/login');
  },

  async getStatus(): Promise<YouTubeConnectionStatus> {
    return apiFetch<YouTubeConnectionStatus>('/api/v1/youtube/status');
  },

  async getStats(forceRefresh = false): Promise<YouTubeChannelStats> {
    const params = forceRefresh ? '?force_refresh=true' : '';
    return apiFetch<YouTubeChannelStats>(`/api/v1/youtube/stats${params}`);
  },

  async refreshToken(): Promise<{ message: string; expires_at: string }> {
    return apiFetch<{ message: string; expires_at: string }>('/api/v1/youtube/refresh', {
      method: 'POST',
    });
  },

  async disconnect(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/v1/youtube/disconnect', {
      method: 'DELETE',
    });
  },

  async getRecentVideos(maxResults = 10): Promise<YouTubeVideosResponse> {
    return apiFetch<YouTubeVideosResponse>(`/api/v1/youtube/videos?max_results=${maxResults}`);
  },
};

// ============ INTEGRATIONS API ============

export interface PlatformStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  category: 'video' | 'music' | 'social';
  available: boolean;
  connected: boolean;
  login_endpoint: string | null;
  disconnect_endpoint: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  expires_at: string | null;
  token_expired: boolean;
}

export interface IntegrationsOverview {
  platforms: PlatformStatus[];
  connected_count: number;
  total_available: number;
}

export interface IntegrationsSummary {
  connected: string[];
  count: number;
}

export const integrationsApi = {
  /** Returns all platforms with live connected/disconnected status. */
  async getAll(): Promise<IntegrationsOverview> {
    return apiFetch<IntegrationsOverview>('/api/v1/integrations/');
  },

  /** Lightweight — just which platform IDs are connected. */
  async getSummary(): Promise<IntegrationsSummary> {
    return apiFetch<IntegrationsSummary>('/api/v1/integrations/summary');
  },

  /**
   * Initiate OAuth connect for any platform.
   * Calls the platform's login endpoint to get an auth URL, then redirects.
   */
  async connect(loginEndpoint: string): Promise<void> {
    const data = await apiFetch<{ auth_url: string }>(loginEndpoint);
    window.location.href = data.auth_url;
  },

  /**
   * Disconnect a platform using its disconnect endpoint.
   */
  async disconnect(disconnectEndpoint: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(disconnectEndpoint, { method: 'DELETE' });
  },
};


// ============ EARNINGS & PAYOUTS API ============

export interface TrackEarnings {
  track_id: number;
  title: string;
  spotify_streams: number;
  youtube_views: number;
  other_streams: number;
  spotify_revenue: number;
  youtube_revenue: number;
  other_revenue: number;
  gross_revenue: number;
  royalty_share: number;
  net_revenue: number;
}

export interface EarningsSummary {
  tracks: TrackEarnings[];
  lifetime_gross: number;
  lifetime_net: number;
  platform_totals: Record<string, number>;
}

export interface WalletData {
  balance: number;
  lifetime_earnings: number;
  withdrawn: number;
  pending_payouts: number;
}

export interface PayoutRecord {
  id: number;
  amount: number;
  method: string;
  status: 'processing' | 'completed' | 'rejected';
  reference: string | null;
  created_at: string;
  completed_at: string | null;
}

export const earningsApi = {
  async getSummary(): Promise<EarningsSummary> {
    return apiFetch<EarningsSummary>('/api/v1/earnings/summary');
  },

  async getWallet(): Promise<WalletData> {
    return apiFetch<WalletData>('/api/v1/earnings/wallet');
  },

  async withdraw(amount: number, method = 'bank_transfer'): Promise<PayoutRecord> {
    return apiFetch<PayoutRecord>('/api/v1/earnings/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, method }),
    });
  },

  async getPayouts(): Promise<PayoutRecord[]> {
    return apiFetch<PayoutRecord[]>('/api/v1/earnings/payouts');
  },

  /** Downloads the CSV statement via a blob (cookie-authenticated). */
  async downloadStatement(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/earnings/statement`, {
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError(res.status, 'Failed to download statement');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nextdrop_statement_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ============ NOTIFICATIONS API ============

export type NotificationType =
  | 'track_approved' | 'track_rejected'
  | 'artist_approved' | 'artist_rejected'
  | 'payout_completed' | 'payout_rejected'
  | 'verification_granted' | 'collab_request'
  | 'collab_accepted' | 'collab_rejected';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  async getAll(skip = 0, limit = 20): Promise<PaginatedResponse<AppNotification>> {
    return apiFetch<PaginatedResponse<AppNotification>>(`/api/v1/notifications/?skip=${skip}&limit=${limit}`);
  },

  async getUnreadCount(): Promise<{ unread_count: number }> {
    return apiFetch<{ unread_count: number }>('/api/v1/notifications/unread-count');
  },

  async markRead(notificationId: number): Promise<AppNotification> {
    return apiFetch<AppNotification>(`/api/v1/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  async markAllRead(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/v1/notifications/read-all', {
      method: 'PUT',
    });
  },
};

// ============ DISTRIBUTION API ============

export interface TrackDistributionStatus {
  id: number;
  track_id: number;
  platform: string;
  status: 'pending' | 'processing' | 'live' | 'failed' | 'removed';
  platform_track_id: string | null;
  platform_url: string | null;
  error_message: string | null;
  territories: string[] | null;
  distributed_at: string | null;
}

export interface DistributionPlatform {
  id: string;
  name: string;
  description: string;
  color: string;
  category: string;
  supports_distribution: boolean;
  connected: boolean;
  login_endpoint: string | null;
}

export const distributionApi = {
  async getPlatforms(): Promise<DistributionPlatform[]> {
    return apiFetch<DistributionPlatform[]>('/api/v1/distribution/platforms');
  },

  async distribute(trackId: number, platformId: string, territories?: string[] | null, options?: Record<string, unknown>): Promise<TrackDistributionStatus> {
    return apiFetch<TrackDistributionStatus>('/api/v1/distribution/', {
      method: 'POST',
      body: JSON.stringify({
        track_id: trackId,
        platform_id: platformId,
        territories: territories && territories.length > 0 ? territories : null,
        options: options || {},
      }),
    });
  },

  async getTrackDistributions(trackId: number): Promise<TrackDistributionStatus[]> {
    return apiFetch<TrackDistributionStatus[]>(`/api/v1/distribution/track/${trackId}`);
  },
};

// ============ FEED API (JAM JAR / OPEN VERSE) ============

export type PostType = 'snippet' | 'open_verse' | 'general';

export interface TrackInfo {
  id: number;
  title: string;
  file_url: string;
  duration: number;
  genre: string | null;
  bpm: number | null;
  key: string | null;
}

export interface ArtistInfo {
  id: number;
  stage_name: string;
  profile_picture: string | null;
}

export interface CommentData {
  id: number;
  post_id: number;
  artist: ArtistInfo;
  text: string;
  created_at: string;
}

export interface Liker {
  artist: ArtistInfo;
  created_at: string;
}

export interface SocialPost {
  id: number;
  artist: ArtistInfo;
  track: TrackInfo | null;
  content: string;
  post_type: PostType;
  like_count: number;
  comment_count: number;
  created_at: string;
  is_liked: boolean;
  comments: CommentData[];
  my_collab_id: number | null;
  my_collab_status: 'pending' | 'accepted' | 'completed' | 'rejected' | null;
}

export interface CreatePostRequest {
  content: string;
  post_type: PostType;
  track_id?: number;
}

export interface LikeResponse {
  message: string;
  like_count: number;
  is_liked: boolean;
}

export interface CollabRequestResponse {
  message: string;
  collaboration_id: number;
  to_artist: string;
  track_title: string | null;
}

export const feedApi = {
  async createPost(data: CreatePostRequest): Promise<SocialPost> {
    return apiFetch<SocialPost>('/api/v1/feed/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getFeed(skip = 0, limit = 20, postType?: PostType): Promise<PaginatedResponse<SocialPost>> {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (postType) params.append('post_type', postType);
    return apiFetch<PaginatedResponse<SocialPost>>(`/api/v1/feed/feed?${params}`);
  },

  async getPost(postId: number): Promise<SocialPost> {
    return apiFetch<SocialPost>(`/api/v1/feed/posts/${postId}`);
  },

  async likePost(postId: number): Promise<LikeResponse> {
    return apiFetch<LikeResponse>(`/api/v1/feed/posts/${postId}/like`, {
      method: 'POST',
    });
  },

  async commentOnPost(postId: number, text: string): Promise<CommentData> {
    return apiFetch<CommentData>(`/api/v1/feed/posts/${postId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async getPostComments(postId: number, skip = 0, limit = 20): Promise<PaginatedResponse<CommentData>> {
    return apiFetch<PaginatedResponse<CommentData>>(`/api/v1/feed/posts/${postId}/comments?skip=${skip}&limit=${limit}`);
  },

  async getPostLikes(postId: number, skip = 0, limit = 20): Promise<PaginatedResponse<Liker>> {
    return apiFetch<PaginatedResponse<Liker>>(`/api/v1/feed/posts/${postId}/likes?skip=${skip}&limit=${limit}`);
  },

  async sendCollabRequest(postId: number, message?: string): Promise<CollabRequestResponse> {
    return apiFetch<CollabRequestResponse>(`/api/v1/feed/posts/${postId}/collab-request`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async deletePost(postId: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/v1/feed/posts/${postId}`, {
      method: 'DELETE',
    });
  },
};

// ============ ANALYZE API (AI Auto-Tagger) ============

export interface AnalyzeTagItem {
  name: string;
  confidence: number; // 0-100
}

export interface AnalyzeResult {
  bpm: number | null;
  key: string | null;
  genre: AnalyzeTagItem[];
  style: AnalyzeTagItem[];
  mood: AnalyzeTagItem[];
  instruments: AnalyzeTagItem[];
  vocals: AnalyzeTagItem[];
  hit_score: number | null;
  features: Record<string, number | string | boolean> | null;
  hit_factors: Record<string, string | number> | null;
  tags_raw: Array<{ tag: string; score: number }> | null;
  musicnn_error: string | null;
}

export const analyzeApi = {
  async analyzeFile(file: File): Promise<AnalyzeResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/v1/tracks/analyze`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
      // Note: Do NOT set Content-Type header — browser sets it with boundary
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Analysis failed' }));
      throw new ApiError(response.status, errorData.detail || 'Analysis failed');
    }

    return response.json();
  },
};

// ============ AI FEATURES API ============

export interface MetadataSuggestion {
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  energy: number;
  danceability: number;
  confidence: number;
}

export interface PerformanceInsight {
  headline: string;
  body: string;
  trend: 'up' | 'down' | 'stable';
  percentage_change: number;
  tip: string;
}

export interface TerritoryGrowthItem {
  country: string;
  country_code: string;
  growth_percentage: number;
  streams: number;
  reason: string;
  flag_emoji: string;
}

export interface TerritoryGrowthData {
  territories: TerritoryGrowthItem[];
  summary: string;
}

export interface ReleaseWindow {
  day: string;
  time_utc: string;
  time_label: string;
  score: number;
}

export interface ReleaseTimingData {
  golden_window: ReleaseWindow;
  alternatives: ReleaseWindow[];
  justification: string;
  playlist_target: string;
}

export const aiApi = {
  async suggestMetadata(audioFileId?: number, title?: string): Promise<MetadataSuggestion> {
    return apiFetch<MetadataSuggestion>('/api/ai/suggest-metadata', {
      method: 'POST',
      body: JSON.stringify({ audio_file_id: audioFileId || null, title: title || null }),
    });
  },

  async getPerformanceInsight(data: {
    track_title: string;
    current_streams: number;
    previous_streams: number;
    current_saves?: number;
    previous_saves?: number;
  }): Promise<PerformanceInsight> {
    return apiFetch<PerformanceInsight>('/api/ai/performance-insight', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getTerritoryGrowth(): Promise<TerritoryGrowthData> {
    return apiFetch<TerritoryGrowthData>('/api/ai/territory-growth');
  },

  async getReleaseTiming(): Promise<ReleaseTimingData> {
    return apiFetch<ReleaseTimingData>('/api/ai/release-timing');
  },

  async getAudioDNA(title?: string, audioFileId?: number): Promise<AudioDNAData> {
    return apiFetch<AudioDNAData>('/api/ai/audio-dna', {
      method: 'POST',
      body: JSON.stringify({ title: title || null, audio_file_id: audioFileId || null }),
    });
  },
};

// ============ AUDIO DNA TYPES ============

export interface AudioFeature {
  name: string;
  value: number;
  raw_value: number;
  unit: string;
}

export interface AudioDNACategory {
  category: string;
  color: string;
  features: AudioFeature[];
}

export interface AudioDNAData {
  track_title: string;
  categories: AudioDNACategory[];
  overall_quality: number;
}

export async function fetchAIMetadataSuggestions(trackId: string) {
  const res = await fetch(`${API_BASE_URL}/api/ai/metadata-suggest/${trackId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch metadata suggestions');
  return res.json();
}

export async function fetchAIPerformanceInsights(trackId: string) {
  const res = await fetch(`${API_BASE_URL}/api/ai/performance-insights/${trackId}`);
  if (!res.ok) throw new Error('Failed to fetch performance insights');
  return res.json();
}

export async function fetchAITerritoryGrowthMap(trackId: string) {
  const res = await fetch(`${API_BASE_URL}/api/ai/territory-growth/${trackId}`);
  if (!res.ok) throw new Error('Failed to fetch territory growth map');
  return res.json();
}

export async function fetchAIReleaseTiming(payload: {
  track_id: string;
  genre: string;
  target_market: string;
  planned_lead_time_days: number;
}) {
  const res = await fetch(`${API_BASE_URL}/api/ai/release-timer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to fetch release timing recommendation');
  return res.json();
}

