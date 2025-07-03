import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AuthService } from './auth';
import { 
  Post, 
  Comment, 
  Chat, 
  Message, 
  CreatePostRequest, 
  CreateCommentRequest, 
  CreateChatRequest, 
  SendMessageRequest,
  FileUploadRequest,
  FileUploadResponse,
  ApiResponse,
  PaginatedResponse 
} from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await AuthService.refreshSession();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const newToken = await AuthService.refreshSession();
          if (newToken && error.config) {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return this.client.request(error.config);
          } else {
            // Redirect to login
            window.location.href = '/auth/signin';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Posts API
  async getPosts(params?: { limit?: number; nextToken?: string; userId?: string }): Promise<PaginatedResponse<Post>> {
    const response = await this.client.get('/posts', { params });
    return response.data.data;
  }

  async getPost(id: string): Promise<Post> {
    const response = await this.client.get(`/posts/${id}`);
    return response.data.data;
  }

  async createPost(data: CreatePostRequest): Promise<Post> {
    const response = await this.client.post('/posts', data);
    return response.data.data;
  }

  async updatePost(id: string, data: Partial<CreatePostRequest>): Promise<Post> {
    const response = await this.client.put(`/posts/${id}`, data);
    return response.data.data;
  }

  async deletePost(id: string): Promise<void> {
    await this.client.delete(`/posts/${id}`);
  }

  async likePost(id: string): Promise<void> {
    await this.client.post(`/posts/${id}/like`);
  }

  async unlikePost(id: string): Promise<void> {
    await this.client.delete(`/posts/${id}/like`);
  }

  // Comments API
  async getComments(postId: string, params?: { limit?: number; nextToken?: string; includeReplies?: boolean }): Promise<PaginatedResponse<Comment>> {
    const response = await this.client.get(`/posts/${postId}/comments`, { params });
    return response.data.data;
  }

  async createComment(postId: string, data: CreateCommentRequest): Promise<Comment> {
    const response = await this.client.post(`/posts/${postId}/comments`, data);
    return response.data.data;
  }

  async updateComment(id: string, data: { content: string }): Promise<Comment> {
    const response = await this.client.put(`/comments/${id}`, data);
    return response.data.data;
  }

  async deleteComment(id: string): Promise<void> {
    await this.client.delete(`/comments/${id}`);
  }

  async likeComment(id: string): Promise<void> {
    await this.client.post(`/comments/${id}/like`);
  }

  async unlikeComment(id: string): Promise<void> {
    await this.client.delete(`/comments/${id}/like`);
  }

  // Chat API
  async getChats(params?: { limit?: number; nextToken?: string }): Promise<PaginatedResponse<Chat>> {
    const response = await this.client.get('/chats', { params });
    return response.data.data;
  }

  async getChat(id: string): Promise<Chat> {
    const response = await this.client.get(`/chats/${id}`);
    return response.data.data;
  }

  async createChat(data: CreateChatRequest): Promise<Chat> {
    const response = await this.client.post('/chats', data);
    return response.data.data;
  }

  async updateChat(id: string, data: Partial<CreateChatRequest>): Promise<Chat> {
    const response = await this.client.put(`/chats/${id}`, data);
    return response.data.data;
  }

  async deleteChat(id: string): Promise<void> {
    await this.client.delete(`/chats/${id}`);
  }

  async addChatParticipant(chatId: string, userId: string): Promise<void> {
    await this.client.post(`/chats/${chatId}/participants`, { userId });
  }

  async removeChatParticipant(chatId: string, userId: string): Promise<void> {
    await this.client.delete(`/chats/${chatId}/participants/${userId}`);
  }

  // Messages API
  async getMessages(chatId: string, params?: { limit?: number; nextToken?: string }): Promise<PaginatedResponse<Message>> {
    const response = await this.client.get(`/chats/${chatId}/messages`, { params });
    return response.data.data;
  }

  async sendMessage(chatId: string, data: SendMessageRequest): Promise<Message> {
    const response = await this.client.post(`/chats/${chatId}/messages`, data);
    return response.data.data;
  }

  async updateMessage(id: string, data: { content: string }): Promise<Message> {
    const response = await this.client.put(`/messages/${id}`, data);
    return response.data.data;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.client.delete(`/messages/${id}`);
  }

  async markMessageAsRead(messageId: string, chatId: string): Promise<void> {
    await this.client.post(`/messages/${messageId}/read`, { chatId });
  }

  // File Upload API
  async getUploadUrl(data: FileUploadRequest): Promise<FileUploadResponse> {
    const response = await this.client.post('/upload', data);
    return response.data.data;
  }

  async uploadFile(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    });
  }

  // User API
  async getUser(id: string): Promise<any> {
    const response = await this.client.get(`/users/${id}`);
    return response.data.data;
  }

  async updateProfile(data: any): Promise<any> {
    const response = await this.client.put('/users/profile', data);
    return response.data.data;
  }

  async searchUsers(query: string): Promise<any[]> {
    const response = await this.client.get('/users/search', { params: { q: query } });
    return response.data.data;
  }

  // Utility method for custom requests
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request(config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

// Convenience hooks for React Query
export const apiQueries = {
  posts: {
    list: (params?: { limit?: number; nextToken?: string; userId?: string }) => ({
      queryKey: ['posts', params],
      queryFn: () => apiClient.getPosts(params)
    }),
    detail: (id: string) => ({
      queryKey: ['posts', id],
      queryFn: () => apiClient.getPost(id)
    })
  },
  
  comments: {
    list: (postId: string, params?: { limit?: number; nextToken?: string; includeReplies?: boolean }) => ({
      queryKey: ['comments', postId, params],
      queryFn: () => apiClient.getComments(postId, params)
    })
  },
  
  chats: {
    list: (params?: { limit?: number; nextToken?: string }) => ({
      queryKey: ['chats', params],
      queryFn: () => apiClient.getChats(params)
    }),
    detail: (id: string) => ({
      queryKey: ['chats', id],
      queryFn: () => apiClient.getChat(id)
    })
  },
  
  messages: {
    list: (chatId: string, params?: { limit?: number; nextToken?: string }) => ({
      queryKey: ['messages', chatId, params],
      queryFn: () => apiClient.getMessages(chatId, params)
    })
  }
};

export default apiClient;
