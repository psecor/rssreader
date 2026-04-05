export interface User {
  id: number;
  googleId: string;
  email: string;
  name: string | null;
}

export interface Category {
  id: number;
  name: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  feeds?: Feed[];
}

export interface Feed {
  id: number;
  title: string;
  url: string;
  description?: string;
  categoryId: number;
  userId: number;
  lastFetchedAt?: string;
  lastFetchError?: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  category?: {
    id: number;
    name: string;
  };
  _count?: {
    items: number;
  };
}

export interface FeedItem {
  id: number;
  feedId: number;
  title: string;
  link: string;
  description?: string;
  contentHtml?: string;
  author?: string;
  pubDate?: string;
  guid: string;
  thumbnail?: string;
  createdAt: string;
  feed?: {
    id: number;
    title: string;
    categoryId: number;
    category?: { id: number; name: string };
  };
  isRead: boolean;
  readAt?: string | null;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface CreateFeedRequest {
  url: string;
  categoryId: number;
  title?: string;
}

export interface UpdateFeedRequest {
  title?: string;
  categoryId?: number;
}

export interface MarkReadRequest {
  feedItemIds: number[];
  opened?: boolean;
}

export interface MarkUnreadRequest {
  feedItemId: number;
}

export interface MarkAllReadRequest {
  feedId?: number;
  categoryId?: number;
}

export interface FeedIndexItem {
  id: number;
  title: string;
  url: string;
  lastFetchedAt?: string;
  unreadCount: number;
}

export interface CategoryIndex {
  id: number;
  name: string;
  feeds: FeedIndexItem[];
}

export interface HistoryItem {
  id: number;
  title: string;
  link: string;
  pubDate?: string;
  author?: string;
  thumbnail?: string;
  feed?: { id: number; title: string; categoryId: number; };
  readAt: string;
  isRead: true;
}

export interface ReadingStats {
  today: number;
  week: number;
  month: number;
  allTime: number;
  todayRead: number;
  weekRead: number;
  monthRead: number;
  allTimeRead: number;
}
