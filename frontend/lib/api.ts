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
  processing_status?: string;
  ai_analysis?: AIAnalysisResponse | null;
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
  hit_factors: Record<string, string>;
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
}

export interface DashboardData {
  total_streams: number;
  total_saves: number;
  total_shares: number;
  average_hit_score: number | null;
  top_track_id: number | null;
  monthly_revenue_prediction: number | null;
}

export interface RevenuePrediction {
  id: number;
  artist_id: number;
  predicted_monthly_revenue: number;
  confidence_interval: number;
  calculation_date: string;
}

export interface Collaboration {
  id: number;
  initiator_id: number;
  collaborator_id: number;
  track_id: number | null;
  status: 'pending' | 'accepted' | 'completed';
  message: string | null;
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

  async login(email: string, password: string): Promise<LoginResponse> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

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
};

// ============ ARTIST API ============

export const artistApi = {
  async getMyProfile(): Promise<Artist> {
    return apiFetch<Artist>('/api/v1/artists/me');
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

  async getArtist(artistId: number): Promise<Artist> {
    return apiFetch<Artist>(`/api/v1/artists/${artistId}`);
  },

  async listArtists(skip = 0, limit = 50): Promise<Artist[]> {
    return apiFetch<Artist[]>(`/api/v1/artists/?skip=${skip}&limit=${limit}`);
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

  async createTrack(data: Omit<Track, 'id' | 'artist_id'>): Promise<Track> {
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
};

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
};

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

  async respondToCollaboration(collabId: number, status: 'accepted' | 'completed'): Promise<Collaboration> {
    return apiFetch<Collaboration>(`/api/v1/social/collaborations/${collabId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
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
};
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
};

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