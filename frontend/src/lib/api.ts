import { startLoading, stopLoading } from './loadingIndicator';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface TagWithCount {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

export interface AdjacentPost {
  slug: string;
  title: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  tags: Tag[];
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  previousPost?: AdjacentPost | null;
  nextPost?: AdjacentPost | null;
}

export interface Comment {
  id: string;
  content: string;
  approved: boolean;
  isOwnerReply: boolean;
  parentId: string | null;
  createdAt: string;
  user: {
    id: string | null;
    name: string;
    avatarUrl: string | null;
  };
  /** Only present on top-level comments — from the public list endpoint
   * (masked, approved only) or the admin endpoints (real identity, all). */
  replies?: Comment[];
}

export interface AdminComment extends Comment {
  post: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
}

export interface Subscriber {
  id: string;
  email: string;
  status: 'PENDING' | 'CONFIRMED' | 'UNSUBSCRIBED';
  confirmedAt: string | null;
  createdAt: string;
  blockedAt: string | null;
}

export interface MediaItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  usageCount: number;
}

export interface MediaDetail extends MediaItem {
  posts: { id: string; title: string; slug: string }[];
  usedInAboutPage: boolean;
  usedInSupportPage: boolean;
}

export interface AboutPage {
  id: string;
  content: string;
  updatedAt: string;
}

export interface SupportPage {
  id: string;
  content: string;
  updatedAt: string;
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  meta: CursorPaginationMeta;
}

/** Global admin comment listing also returns a total count (cheap indexed
 * count, not tied to how deep the cursor pagination goes) for the dashboard. */
export interface AdminCommentsResponse extends CursorPaginatedResponse<AdminComment> {
  meta: CursorPaginationMeta & { total: number };
}

/** Subscriber list also returns aggregate counts by status for the dashboard
 * stat cards — a separate concern from the paginated rows themselves. */
export interface SubscribersResponse extends CursorPaginatedResponse<Subscriber> {
  counts: { total: number; confirmed: number; pending: number; unsubscribed: number };
}

/** Admin post listing — includes drafts, also returns a total count. */
export interface AdminPostsResponse extends CursorPaginatedResponse<Post> {
  meta: CursorPaginationMeta & { total: number };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Error class

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// API Client

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    startLoading();
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers: HeadersInit = {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      };

      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(
          body?.error || `Request failed with status ${response.status}`,
          response.status,
          body
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } finally {
      stopLoading();
    }
  }

  private authHeaders(token?: string): HeadersInit {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  // Posts

  async getPosts(params?: { cursor?: string; limit?: number; tag?: string; search?: string }): Promise<CursorPaginatedResponse<Post>> {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return this.request<CursorPaginatedResponse<Post>>(`/posts${query ? `?${query}` : ''}`);
  }

  async getAdminPosts(token: string, params?: { cursor?: string; status?: 'DRAFT' | 'PUBLISHED' }): Promise<AdminPostsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return this.request<AdminPostsResponse>(`/posts/admin${query ? `?${query}` : ''}`, {
      headers: this.authHeaders(token),
    });
  }

  async getTags(): Promise<TagWithCount[]> {
    return this.request<TagWithCount[]>('/tags');
  }

  async getPost(slug: string): Promise<Post> {
    return this.request<Post>(`/posts/${slug}`);
  }

  async getPostById(id: string, token: string): Promise<Post> {
    return this.request<Post>(`/posts/admin/${id}`, {
      headers: this.authHeaders(token),
    });
  }

  async createPost(
    data: {
      title: string;
      excerpt?: string;
      content: string;
      coverImage?: string;
      tags?: string[];
      status?: 'DRAFT' | 'PUBLISHED';
      publishedAt?: string;
    },
    token: string
  ): Promise<Post> {
    return this.request<Post>('/posts', {
      method: 'POST',
      headers: this.authHeaders(token),
      body: JSON.stringify(data),
    });
  }

  async updatePost(id: string, data: {
    title?: string;
    excerpt?: string;
    content?: string;
    coverImage?: string;
    tags?: string[];
    status?: 'DRAFT' | 'PUBLISHED';
    publishedAt?: string;
  }, token: string): Promise<Post> {
    return this.request<Post>(`/posts/${id}`, {
      method: 'PUT',
      headers: this.authHeaders(token),
      body: JSON.stringify(data),
    });
  }

  async deletePost(id: string, token: string): Promise<void> {
    return this.request<void>(`/posts/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(token),
    });
  }

  async publishPost(id: string, token: string): Promise<Post> {
    return this.request<Post>(`/posts/${id}/publish`, {
      method: 'PATCH',
      headers: this.authHeaders(token),
    });
  }

  // Comments

  async getComments(postId: string): Promise<CursorPaginatedResponse<Comment>> {
    return this.request<CursorPaginatedResponse<Comment>>(`/posts/${postId}/comments`);
  }

  async getPostComments(postId: string, token: string): Promise<CursorPaginatedResponse<Comment>> {
    return this.request<CursorPaginatedResponse<Comment>>(`/posts/${postId}/comments/all`, {
      headers: this.authHeaders(token),
    });
  }

  async getAdminComments(token: string, params?: { cursor?: string; approved?: string }): Promise<AdminCommentsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.approved) searchParams.set('approved', params.approved);
    const query = searchParams.toString();
    return this.request<AdminCommentsResponse>(`/comments/admin${query ? `?${query}` : ''}`, {
      headers: this.authHeaders(token),
    });
  }

  async createComment(postId: string, content: string, token: string): Promise<Comment> {
    return this.request<Comment>(`/posts/${postId}/comments`, {
      method: 'POST',
      headers: this.authHeaders(token),
      body: JSON.stringify({ content }),
    });
  }

  async replyAsBroomn(id: string, content: string, token: string): Promise<Comment> {
    return this.request<Comment>(`/comments/${id}/reply`, {
      method: 'POST',
      headers: this.authHeaders(token),
      body: JSON.stringify({ content }),
    });
  }

  async approveComment(id: string, approved: boolean, token: string): Promise<Comment> {
    return this.request<Comment>(`/comments/${id}/approve`, {
      method: 'PATCH',
      headers: this.authHeaders(token),
      body: JSON.stringify({ approved }),
    });
  }

  async deleteComment(id: string, token: string): Promise<void> {
    return this.request<void>(`/comments/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(token),
    });
  }

  // Auth

  async loginWithGoogle(code: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getMe(token: string): Promise<User> {
    return this.request<User>('/auth/me', {
      headers: this.authHeaders(token),
    });
  }

  // Newsletter

  async subscribe(email: string): Promise<Subscriber> {
    return this.request<Subscriber>('/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async confirmSubscription(token: string): Promise<{ message: string; subscriber: { email: string } }> {
    return this.request(`/newsletter/confirm?token=${encodeURIComponent(token)}`);
  }

  async unsubscribeFromNewsletter(token: string): Promise<{ message: string; subscriber: { email: string } }> {
    return this.request(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
  }

  async getSubscribers(
    token: string,
    params?: { cursor?: string; status?: string; email?: string }
  ): Promise<SubscribersResponse> {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.email) searchParams.set('email', params.email);
    const query = searchParams.toString();
    return this.request<SubscribersResponse>(`/newsletter/subscribers${query ? `?${query}` : ''}`, {
      headers: this.authHeaders(token),
    });
  }

  async adminUnsubscribeSubscriber(id: string, token: string): Promise<Subscriber> {
    return this.request<Subscriber>(`/newsletter/subscribers/${id}/unsubscribe`, {
      method: 'POST',
      headers: this.authHeaders(token),
    });
  }

  async blockSubscriber(id: string, token: string): Promise<Subscriber> {
    return this.request<Subscriber>(`/newsletter/subscribers/${id}/block`, {
      method: 'PATCH',
      headers: this.authHeaders(token),
    });
  }

  async unblockSubscriber(id: string, token: string): Promise<Subscriber> {
    return this.request<Subscriber>(`/newsletter/subscribers/${id}/unblock`, {
      method: 'PATCH',
      headers: this.authHeaders(token),
    });
  }

  async sendNewsletter(
    data: { subject: string; content: string },
    token: string
  ): Promise<{ sent: number }> {
    return this.request<{ sent: number }>('/newsletter/send', {
      method: 'POST',
      headers: this.authHeaders(token),
      body: JSON.stringify(data),
    });
  }

  // Media

  async uploadMedia(file: File, token: string): Promise<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(
        body?.error || `Request failed with status ${response.status}`,
        response.status,
        body
      );
    }

    return response.json();
  }

  async getMedia(token: string, params?: { cursor?: string; limit?: number; search?: string }): Promise<CursorPaginatedResponse<MediaItem>> {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return this.request<CursorPaginatedResponse<MediaItem>>(`/media${query ? `?${query}` : ''}`, {
      headers: this.authHeaders(token),
    });
  }

  async getMediaById(id: string, token: string): Promise<MediaDetail> {
    return this.request<MediaDetail>(`/media/${id}`, {
      headers: this.authHeaders(token),
    });
  }

  async deleteMedia(id: string, token: string): Promise<void> {
    return this.request<void>(`/media/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(token),
    });
  }

  async replaceMedia(id: string, newUrl: string, token: string): Promise<{ message: string; postsUpdated: number }> {
    return this.request<{ message: string; postsUpdated: number }>(`/media/${id}/replace`, {
      method: 'PATCH',
      headers: this.authHeaders(token),
      body: JSON.stringify({ newUrl }),
    });
  }

  // About page

  async getAbout(): Promise<AboutPage> {
    return this.request<AboutPage>('/about');
  }

  async updateAbout(content: string, token: string): Promise<AboutPage> {
    return this.request<AboutPage>('/about', {
      method: 'PUT',
      headers: this.authHeaders(token),
      body: JSON.stringify({ content }),
    });
  }

  // Support page

  async getSupport(): Promise<SupportPage> {
    return this.request<SupportPage>('/support');
  }

  async updateSupport(content: string, token: string): Promise<SupportPage> {
    return this.request<SupportPage>('/support', {
      method: 'PUT',
      headers: this.authHeaders(token),
      body: JSON.stringify({ content }),
    });
  }
}

const api = new ApiClient(API_URL);
export default api;
