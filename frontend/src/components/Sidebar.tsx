import React, { useState } from 'react';
import { Category, Feed } from '../types';
import { categoriesApi, feedsApi } from '../services/api';

interface SidebarProps {
  categories: Category[];
  onCategorySelect: (category: Category) => void;
  onFeedSelect: (feed: Feed) => void;
  onAllItemsSelect: () => void;
  onIndexSelect: () => void;
  onHistorySelect: () => void;
  onAddFeed: () => void;
  onAddCategory: () => void;
  onCategoriesUpdate: () => void;
  selectedFeed: Feed | null;
  selectedCategory: Category | null;
  showIndex: boolean;
  showHistory: boolean;
  onEditFeed: (feed: Feed) => void;
  mobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  categories,
  onCategorySelect,
  onFeedSelect,
  onAllItemsSelect,
  onIndexSelect,
  onHistorySelect,
  onAddFeed,
  onAddCategory,
  onCategoriesUpdate,
  selectedFeed,
  selectedCategory,
  showIndex,
  showHistory,
  onEditFeed,
  mobileMenuOpen,
  onMobileMenuClose,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await feedsApi.refreshAll();
      onCategoriesUpdate();
    } catch (error) {
      console.error('Error refreshing feeds:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryUnreadCount = (category: Category): number => {
    if (!category.feeds) return 0;
    return category.feeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);
  };

  const handleDeleteFeed = async (feedId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this feed?')) {
      try {
        await feedsApi.delete(feedId);
        onCategoriesUpdate();
        if (selectedFeed?.id === feedId) {
          onAllItemsSelect();
        }
      } catch (error) {
        console.error('Error deleting feed:', error);
        alert('Failed to delete feed');
      }
    }
  };

  const handleDeleteCategory = async (categoryId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this category and all its feeds?')) {
      try {
        await categoriesApi.delete(categoryId);
        onCategoriesUpdate();
        if (selectedCategory?.id === categoryId) {
          onAllItemsSelect();
        }
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category');
      }
    }
  };

  return (
    <>
      <div className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <button
            className="mobile-close-btn"
            onClick={onMobileMenuClose}
            aria-label="Close menu"
          >
            ×
          </button>
          <h2>RSS Reader</h2>
          <button onClick={onAddFeed} className="add-button">
            Add Feed
          </button>
          <button onClick={onAddCategory} className="add-category-button">
            + Category
          </button>
          <button
            onClick={handleRefreshAll}
            className="refresh-all-button"
            disabled={refreshing}
            title="Refresh all feeds"
          >
            {refreshing ? '↻' : '↻'}
          </button>
        </div>

      <div className="sidebar-item all-items" onClick={onAllItemsSelect}>
        <span className={!selectedFeed && !selectedCategory && !showIndex && !showHistory ? 'active' : ''}>
          All Items
        </span>
      </div>

      <div className="sidebar-item all-items" onClick={onIndexSelect}>
        <span className={showIndex ? 'active' : ''}>
          Index
        </span>
      </div>

      <div className="sidebar-item all-items" onClick={onHistorySelect}>
        <span className={showHistory ? 'active' : ''}>
          History
        </span>
      </div>

      <div className="categories-list">
        {categories.map((category) => (
          <div key={category.id} className="category-section">
            <div className="category-header">
              <button
                onClick={() => toggleCategory(category.id)}
                className="category-toggle"
              >
                {expandedCategories.has(category.id) ? '▾' : '▸'}
              </button>
              <span
                onClick={() => onCategorySelect(category)}
                className={`category-name ${
                  selectedCategory?.id === category.id ? 'active' : ''
                }`}
              >
                {category.name}
              </span>
              {getCategoryUnreadCount(category) > 0 && (
                <span className="sidebar-unread-badge">
                  {getCategoryUnreadCount(category)}
                </span>
              )}
              <button
                onClick={(e) => handleDeleteCategory(category.id, e)}
                className="delete-button"
                title="Delete category"
              >
                ×
              </button>
            </div>

            {expandedCategories.has(category.id) && category.feeds && (
              <div className="feeds-list">
                {category.feeds.map((feed) => (
                  <div
                    key={feed.id}
                    className={`feed-item ${
                      selectedFeed?.id === feed.id ? 'active' : ''
                    }`}
                  >
                    <span
                      className="feed-title"
                      onClick={() => onFeedSelect(feed)}
                    >
                      {feed.title}
                    </span>
                    {(feed.unreadCount || 0) > 0 && (
                      <span className="sidebar-unread-badge">
                        {feed.unreadCount}
                      </span>
                    )}
                    <div className="feed-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditFeed(feed);
                        }}
                        className="settings-button"
                        title="Edit feed settings"
                      >
                        ⚙
                      </button>
                      <button
                        onClick={(e) => handleDeleteFeed(feed.id, e)}
                        className="delete-button"
                        title="Delete feed"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
    {mobileMenuOpen && (
      <div className="sidebar-backdrop" onClick={onMobileMenuClose} />
    )}
    </>
  );
};

export default Sidebar;
