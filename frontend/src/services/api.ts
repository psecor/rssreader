import axios from 'axios';
import {
  User,
  Category,
  Feed,
  FeedItem,
  CreateCategoryRequest,
  CreateFeedRequest,
  UpdateFeedRequest,
  MarkReadRequest,
  MarkUnreadRequest,
  MarkAllReadRequest,
  CategoryIndex,
  HistoryItem,
  ReadingStats,
} from '../types';

const api = axios.create({
  // When deployed, frontend and backend are on same domain via Apache proxy
  // So we can use relative URLs. For local dev, you can set REACT_APP_API_URL
  baseURL: process.env.REACT_APP_API_URL || '',
  withCredentials: true,
});

// Auth
export const authApi = {
  getMe: () => api.get<User>('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Categories
export const categoriesApi = {
  getAll: () => api.get<Category[]>('/api/categories'),
  getIndex: () => api.get<CategoryIndex[]>('/api/categories/index'),
  create: (data: CreateCategoryRequest) => api.post<Category>('/api/categories', data),
  update: (id: number, data: { name: string }) =>
    api.put<Category>(`/api/categories/${id}`, data),
  delete: (id: number) => api.delete(`/api/categories/${id}`),
};

// Feeds
export const feedsApi = {
  getAll: (categoryId?: number) =>
    api.get<Feed[]>('/api/feeds', { params: { categoryId } }),
  getOne: (id: number) => api.get<Feed>(`/api/feeds/${id}`),
  create: (data: CreateFeedRequest) => api.post<Feed>('/api/feeds', data),
  update: (id: number, data: UpdateFeedRequest) =>
    api.put<Feed>(`/api/feeds/${id}`, data),
  delete: (id: number) => api.delete(`/api/feeds/${id}`),
  refresh: (id: number) => api.post(`/api/feeds/${id}/refresh`),
  refreshAll: () => api.post('/api/feeds/refresh-all'),
};

// Feed Items
export const feedItemsApi = {
  getAll: (params?: {
    feedId?: number;
    categoryId?: number;
    isRead?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get<FeedItem[]>('/api/feed-items', { params }),
  getOne: (id: number) => api.get<FeedItem>(`/api/feed-items/${id}`),
};

// History
export const historyApi = {
  getHistory: (params?: { search?: string; limit?: number; offset?: number }) =>
    api.get<HistoryItem[]>('/api/history', { params }),
  getStats: () => api.get<ReadingStats>('/api/history/stats'),
};

// Read Status
export const readStatusApi = {
  markRead: (data: MarkReadRequest) => api.post('/api/read-status/mark-read', data),
  markUnread: (data: MarkUnreadRequest) => api.post('/api/read-status/mark-unread', data),
  markAllRead: (data: MarkAllReadRequest) =>
    api.post('/api/read-status/mark-all-read', data),
};

export default api;
