import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import FeedItemList from '../components/FeedItemList';
import AddFeedModal from '../components/AddFeedModal';
import AddCategoryModal from '../components/AddCategoryModal';
import EditFeedModal from '../components/EditFeedModal';
import IndexView from '../components/IndexView';
import HistoryView from '../components/HistoryView';
import { Category, Feed, FeedItem, CategoryIndex, HistoryItem, ReadingStats } from '../types';
import { categoriesApi, feedItemsApi, historyApi } from '../services/api';

const ReaderPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showEditFeed, setShowEditFeed] = useState(false);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showIndex, setShowIndex] = useState(false);
  const [indexData, setIndexData] = useState<CategoryIndex[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<ReadingStats | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [urlParamsInitialized, setUrlParamsInitialized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadCategories();
    loadStats();
  }, []);

  // Initialize state from URL parameters once categories are loaded
  useEffect(() => {
    if (categories.length === 0 || urlParamsInitialized) return;

    const view = searchParams.get('view');
    const feedId = searchParams.get('feedId');
    const categoryId = searchParams.get('categoryId');
    const unreadOnly = searchParams.get('unreadOnly');
    const search = searchParams.get('search');

    // Set unread filter
    if (unreadOnly === 'true') {
      setShowUnreadOnly(true);
    }

    // Set search query
    if (search) {
      setSearchQuery(search);
    }

    // Set view based on parameters
    if (view === 'history') {
      setShowHistory(true);
    } else if (view === 'index') {
      setShowIndex(true);
    } else if (feedId) {
      // Find and select the feed
      const feed = categories
        .flatMap(cat => cat.feeds || [])
        .find(f => f.id === parseInt(feedId));
      if (feed) {
        setSelectedFeed(feed);
      }
    } else if (categoryId) {
      // Find and select the category
      const category = categories.find(c => c.id === parseInt(categoryId));
      if (category) {
        setSelectedCategory(category);
      }
    }
    // If view === 'all' or no parameters, default state (all items) is already set

    setUrlParamsInitialized(true);
  }, [categories, searchParams, urlParamsInitialized]);

  // Update URL parameters when state changes (after initialization)
  useEffect(() => {
    if (!urlParamsInitialized) return;

    const params = new URLSearchParams();

    // Set view parameter
    if (showHistory) {
      params.set('view', 'history');
    } else if (showIndex) {
      params.set('view', 'index');
    } else if (selectedFeed) {
      params.set('view', 'feed');
      params.set('feedId', selectedFeed.id.toString());
    } else if (selectedCategory) {
      params.set('view', 'category');
      params.set('categoryId', selectedCategory.id.toString());
    } else {
      params.set('view', 'all');
    }

    // Set filter parameters
    if (showUnreadOnly) {
      params.set('unreadOnly', 'true');
    }

    if (searchQuery) {
      params.set('search', searchQuery);
    }

    setSearchParams(params, { replace: true });
  }, [showHistory, showIndex, selectedFeed, selectedCategory, showUnreadOnly, searchQuery, urlParamsInitialized, setSearchParams]);

  useEffect(() => {
    if (showHistory) {
      loadHistory(historySearch);
    } else if (showIndex) {
      loadIndexData();
    } else if (selectedFeed) {
      loadFeedItems();
      loadUnreadCount();
    } else if (selectedCategory) {
      loadCategoryItems();
      loadUnreadCount();
    } else {
      loadAllItems();
      loadUnreadCount();
    }
  }, [selectedFeed, selectedCategory, showIndex, showHistory, searchQuery, showUnreadOnly]);

  useEffect(() => {
    if (showHistory) loadHistory(historySearch);
  }, [historySearch]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadFeedItems = async () => {
    if (!selectedFeed) return;
    setLoading(true);
    try {
      const params: any = { feedId: selectedFeed.id };
      if (searchQuery) params.search = searchQuery;
      if (showUnreadOnly) params.isRead = false;

      const response = await feedItemsApi.getAll(params);
      setFeedItems(response.data);
    } catch (error) {
      console.error('Error loading feed items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryItems = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const params: any = { categoryId: selectedCategory.id };
      if (searchQuery) params.search = searchQuery;
      if (showUnreadOnly) params.isRead = false;

      const response = await feedItemsApi.getAll(params);
      setFeedItems(response.data);
    } catch (error) {
      console.error('Error loading category items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (showUnreadOnly) params.isRead = false;

      const response = await feedItemsApi.getAll(params);
      setFeedItems(response.data);
    } catch (error) {
      console.error('Error loading all items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const params: any = { isRead: false };
      if (selectedFeed) params.feedId = selectedFeed.id;
      if (selectedCategory) params.categoryId = selectedCategory.id;
      if (searchQuery) params.search = searchQuery;

      const response = await feedItemsApi.getCount(params);
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const loadStats = async () => {
    try {
      const res = await historyApi.getStats();
      setHistoryStats(res.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async (search = '') => {
    setLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        historyApi.getHistory({ search, limit: 100 }),
        historyApi.getStats(),
      ]);
      setHistoryItems(itemsRes.data);
      setHistoryStats(statsRes.data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIndexData = async () => {
    setLoading(true);
    try {
      const response = await categoriesApi.getIndex();
      setIndexData(response.data);
    } catch (error) {
      console.error('Error loading index:', error);
    } finally {
      setLoading(false);
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleFeedSelect = (feed: Feed) => {
    setSelectedFeed(feed);
    setSelectedCategory(null);
    setShowIndex(false);
    setShowHistory(false);
    closeMobileMenu();
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setSelectedFeed(null);
    setShowIndex(false);
    setShowHistory(false);
    closeMobileMenu();
  };

  const handleAllItemsSelect = () => {
    setSelectedFeed(null);
    setSelectedCategory(null);
    setShowIndex(false);
    setShowHistory(false);
    closeMobileMenu();
  };

  const handleIndexSelect = () => {
    setSelectedFeed(null);
    setSelectedCategory(null);
    setShowIndex(true);
    setShowHistory(false);
    loadIndexData();
    closeMobileMenu();
  };

  const handleHistorySelect = () => {
    setSelectedFeed(null);
    setSelectedCategory(null);
    setShowIndex(false);
    setShowHistory(true);
    closeMobileMenu();
    loadHistory(historySearch);
  };

  const handleItemUpdate = (patch?: { itemId: number; isRead: boolean }) => {
    if (patch) {
      // Single-item read/unread flip: update state in place instead of
      // reloading. In unread-only mode a reload would drop the item and
      // reshuffle the visible list, which is disruptive when the user was
      // mid-scroll or about to open the next article.
      setFeedItems((prev) =>
        prev.map((item) =>
          item.id === patch.itemId
            ? {
                ...item,
                isRead: patch.isRead,
                readAt: patch.isRead ? new Date().toISOString() : null,
              }
            : item,
        ),
      );
    } else {
      // Bulk operation (mark-all-read) — we don't know which items changed,
      // so fall back to a full reload.
      if (selectedFeed) {
        loadFeedItems();
      } else if (selectedCategory) {
        loadCategoryItems();
      } else {
        loadAllItems();
      }
    }
    loadUnreadCount();
    // Reload categories to update sidebar unread counts
    loadCategories();
    // Refresh top bar stats
    loadStats();
    // Note: no loadIndexData() here. It sets the shared `loading` flag, which
    // would flash "Loading..." over the current feed list on every mark-read.
    // The main useEffect already refetches the index when the user navigates
    // to that view.
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const handleEditFeed = (feed: Feed) => {
    setEditingFeed(feed);
    setShowEditFeed(true);
  };

  return (
    <div className="reader-page">
      <div className="top-bar">
        <button
          className="hamburger-menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className="search-section">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <label className="unread-filter">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>
        </div>
        {historyStats && (
          <div className="reading-stats">
            <span className="reading-stat" title="Articles opened today">{historyStats.today} today</span>
            <span className="reading-stat-sep">·</span>
            <span className="reading-stat" title="Articles opened this week">{historyStats.week} week</span>
            <span className="reading-stat-sep">·</span>
            <span className="reading-stat" title="Articles opened this month">{historyStats.month} month</span>
            <span className="reading-stat-sep">·</span>
            <span className="reading-stat" title="Articles opened all time">{historyStats.allTime} total</span>
          </div>
        )}
        <div className="user-menu">
          <span className="user-name">{user?.name || user?.email}</span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        <Sidebar
          categories={categories}
          onCategorySelect={handleCategorySelect}
          onFeedSelect={handleFeedSelect}
          onAllItemsSelect={handleAllItemsSelect}
          onIndexSelect={handleIndexSelect}
          onHistorySelect={handleHistorySelect}
          onAddFeed={() => setShowAddFeed(true)}
          onAddCategory={() => setShowAddCategory(true)}
          onCategoriesUpdate={loadCategories}
          selectedFeed={selectedFeed}
          selectedCategory={selectedCategory}
          showIndex={showIndex}
          showHistory={showHistory}
          onEditFeed={handleEditFeed}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuClose={closeMobileMenu}
        />

        {showHistory ? (
          <HistoryView
            historyItems={historyItems}
            loading={loading}
            searchQuery={historySearch}
            onSearchChange={setHistorySearch}
          />
        ) : showIndex ? (
          <IndexView
            indexData={indexData}
            loading={loading}
            onFeedSelect={handleFeedSelect}
          />
        ) : (
          <FeedItemList
            items={feedItems}
            loading={loading}
            selectedFeed={selectedFeed}
            selectedCategory={selectedCategory}
            onItemUpdate={handleItemUpdate}
            visibleUnreadCount={feedItems.filter((i) => !i.isRead).length}
            totalUnreadCount={unreadCount}
          />
        )}
      </div>

      {showAddFeed && (
        <AddFeedModal
          categories={categories}
          onClose={() => setShowAddFeed(false)}
          onSuccess={() => {
            setShowAddFeed(false);
            loadCategories();
          }}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onSuccess={() => {
            setShowAddCategory(false);
            loadCategories();
          }}
        />
      )}

      {showEditFeed && editingFeed && (
        <EditFeedModal
          feed={editingFeed}
          categories={categories}
          onClose={() => {
            setShowEditFeed(false);
            setEditingFeed(null);
          }}
          onSuccess={() => {
            setShowEditFeed(false);
            setEditingFeed(null);
            loadCategories();
          }}
        />
      )}
    </div>
  );
};

export default ReaderPage;
