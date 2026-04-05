import React, { useRef, useState } from 'react';
import { FeedItem } from '../types';
import { readStatusApi } from '../services/api';

interface FeedItemCardProps {
  item: FeedItem;
  onUpdate: () => void;
}

const SWIPE_THRESHOLD = 80;

const FeedItemCard: React.FC<FeedItemCardProps> = ({ item, onUpdate }) => {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleClick = async () => {
    if (swiping) return;
    // Open link in new tab immediately
    window.open(item.link, '_blank', 'noopener,noreferrer');
    // Record open (and mark as read if not already)
    try {
      await readStatusApi.markRead({ feedItemIds: [item.id], opened: true });
      if (!item.isRead) onUpdate();
    } catch (error) {
      console.error('Error marking item as read:', error);
    }
  };

  const handleToggleRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (item.isRead) {
        await readStatusApi.markUnread({ feedItemId: item.id });
      } else {
        await readStatusApi.markRead({ feedItemIds: [item.id] });
      }
      onUpdate();
    } catch (error) {
      console.error('Error toggling read status:', error);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only track horizontal swipes (more horizontal than vertical)
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) {
      setSwiping(true);
      setSwipeX(Math.min(dx, 140));
    }
  };

  const handleTouchEnd = async () => {
    if (swipeX >= SWIPE_THRESHOLD && !item.isRead) {
      setConfirming(true);
      setSwipeX(0);
      try {
        await readStatusApi.markRead({ feedItemIds: [item.id] });
        onUpdate();
      } catch (error) {
        console.error('Error marking item as read:', error);
      }
      setTimeout(() => setConfirming(false), 400);
    } else {
      setSwipeX(0);
    }
    setSwiping(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString();
  };

  const swipeProgress = Math.min(swipeX / SWIPE_THRESHOLD, 1);
  const isThresholdMet = swipeX >= SWIPE_THRESHOLD;

  return (
    <div
      className={`feed-item-card ${item.isRead ? 'read' : 'unread'} ${confirming ? 'swipe-confirming' : ''}`}
      style={{ position: 'relative', overflow: 'hidden' }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe background */}
      {(swipeX > 0 || confirming) && (
        <div
          className="swipe-bg"
          style={{ opacity: confirming ? 1 : swipeProgress }}
        >
          <span className="swipe-icon">{isThresholdMet || confirming ? '✓' : '○'}</span>
        </div>
      )}

      {/* Card content, slides right */}
      <div
        className="item-card-content"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? 'transform 0.2s ease' : 'none',
        }}
      >
        {item.thumbnail && (
          <div className="item-thumbnail">
            <img src={item.thumbnail} alt="" loading="lazy" />
          </div>
        )}

        <div className="item-text-content">
          <div className="item-header">
            <h3 className="item-title">
              {item.feed?.category && (
                <span className="category-pill">{item.feed.category.name}</span>
              )}
              {item.title}
            </h3>
            <button
              onClick={handleToggleRead}
              className="read-toggle"
              title={item.isRead ? 'Mark as unread' : 'Mark as read'}
            >
              {item.isRead ? '○' : '●'}
            </button>
          </div>

          {item.description && (
            <p className="item-description">
              {item.description.substring(0, 200)}
              {item.description.length > 200 ? '...' : ''}
            </p>
          )}

          <div className="item-footer">
            {item.feed && <span className="item-source">{item.feed.title}</span>}
            {item.author && <span className="item-author">by {item.author}</span>}
            <span className="item-date">{formatDate(item.pubDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedItemCard;
