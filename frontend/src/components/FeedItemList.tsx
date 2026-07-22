import React, { useRef, useEffect } from 'react';
import { FeedItem, Feed, Category } from '../types';
import FeedItemCard from './FeedItemCard';
import { readStatusApi } from '../services/api';

interface FeedItemListProps {
  items: FeedItem[];
  loading: boolean;
  selectedFeed: Feed | null;
  selectedCategory: Category | null;
  onItemUpdate: (patch?: { itemId: number; isRead: boolean }) => void;
  visibleUnreadCount: number;
  totalUnreadCount: number;
}

const FeedItemList: React.FC<FeedItemListProps> = ({
  items,
  loading,
  selectedFeed,
  selectedCategory,
  onItemUpdate,
  visibleUnreadCount,
  totalUnreadCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef<number>(0);
  const shouldPreserveScroll = useRef<boolean>(false);
  const previousItemCount = useRef<number>(items.length);

  // Restore scroll position after items update
  useEffect(() => {
    if (shouldPreserveScroll.current && containerRef.current) {
      // Restore scroll position
      containerRef.current.scrollTop = savedScrollPosition.current;
      shouldPreserveScroll.current = false;
    } else if (previousItemCount.current !== items.length) {
      // Items count changed significantly (e.g., switching feeds), scroll to top
      if (containerRef.current && Math.abs(previousItemCount.current - items.length) > 5) {
        containerRef.current.scrollTop = 0;
      }
    }
    previousItemCount.current = items.length;
  }, [items]);

  // Wrapper for onItemUpdate that preserves scroll position
  const handleItemUpdate = (patch?: { itemId: number; isRead: boolean }) => {
    if (containerRef.current) {
      savedScrollPosition.current = containerRef.current.scrollTop;
      shouldPreserveScroll.current = true;
    }
    onItemUpdate(patch);
  };

  const handleMarkAllRead = async () => {
    try {
      if (selectedFeed) {
        await readStatusApi.markAllRead({ feedId: selectedFeed.id });
      } else if (selectedCategory) {
        await readStatusApi.markAllRead({ categoryId: selectedCategory.id });
      } else {
        // Mark all visible items as read
        const itemIds = items.map((item) => item.id);
        if (itemIds.length > 0) {
          await readStatusApi.markRead({ feedItemIds: itemIds });
        }
      }
      onItemUpdate();
    } catch (error) {
      console.error('Error marking all as read:', error);
      alert('Failed to mark all as read');
    }
  };

  const getTitle = () => {
    if (selectedFeed) return selectedFeed.title;
    if (selectedCategory) return selectedCategory.name;
    return 'All Items';
  };

  return (
    <div className="feed-item-list" ref={containerRef}>
      <div className="feed-header">
        <div>
          <h2>{getTitle()}</h2>
          {totalUnreadCount > 0 && (
            <span className="unread-count">
              {visibleUnreadCount < totalUnreadCount
                ? `${visibleUnreadCount} of ${totalUnreadCount} unread`
                : `${totalUnreadCount} unread`}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button onClick={handleMarkAllRead} className="mark-all-read-button">
            Mark All as Read
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>No articles found</p>
          <p className="empty-subtitle">
            {selectedFeed || selectedCategory
              ? 'This feed has no articles yet'
              : 'Add a feed to start reading'}
          </p>
        </div>
      ) : (
        <div className="items-container">
          {items.map((item) => (
            <FeedItemCard key={item.id} item={item} onUpdate={handleItemUpdate} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedItemList;
