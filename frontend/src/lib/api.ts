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
}

export interface Comment {
  id: string;
  content: string;
  approved: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
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
  confirmed: boolean;
  createdAt: string;
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
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
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
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(
        body?.message || `Request failed with status ${response.status}`,
        response.status,
        body
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private authHeaders(token?: string): HeadersInit {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  // Posts

  async getPosts(params?: { page?: number; limit?: number; tag?: string; search?: string }): Promise<PaginatedResponse<Post>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return this.request<PaginatedResponse<Post>>(`/posts${query ? `?${query}` : ''}`);
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

  async getComments(postId: string): Promise<PaginatedResponse<Comment>> {
    return this.request<PaginatedResponse<Comment>>(`/posts/${postId}/comments`);
  }

  async getPostComments(postId: string, token: string): Promise<PaginatedResponse<Comment>> {
    return this.request<PaginatedResponse<Comment>>(`/posts/${postId}/comments/all`, {
      headers: this.authHeaders(token),
    });
  }

  async getAdminComments(token: string, params?: { page?: number; approved?: string }): Promise<PaginatedResponse<AdminComment>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.approved) searchParams.set('approved', params.approved);
    const query = searchParams.toString();
    return this.request<PaginatedResponse<AdminComment>>(`/comments/admin${query ? `?${query}` : ''}`, {
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

  async getSubscribers(token: string): Promise<Subscriber[]> {
    return this.request<Subscriber[]>('/newsletter/subscribers', {
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
        body?.message || `Request failed with status ${response.status}`,
        response.status,
        body
      );
    }

    return response.json();
  }

  async getMedia(token: string, params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<MediaItem>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return this.request<PaginatedResponse<MediaItem>>(`/media${query ? `?${query}` : ''}`, {
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
}

const api = new ApiClient(API_URL);
export default api;
