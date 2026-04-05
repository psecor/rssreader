import React from 'react';
import { CategoryIndex, Feed } from '../types';

interface IndexViewProps {
  indexData: CategoryIndex[];
  loading: boolean;
  onFeedSelect: (feed: Feed) => void;
}

const IndexView: React.FC<IndexViewProps> = ({ indexData, loading, onFeedSelect }) => {
  if (loading) {
    return (
      <div className="index-view">
        <div className="index-header">
          <h2>Index</h2>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (indexData.length === 0) {
    return (
      <div className="index-view">
        <div className="index-header">
          <h2>Index</h2>
        </div>
        <div className="index-empty">
          <p>No feeds found</p>
          <p className="empty-subtitle">Add some feeds to get started</p>
        </div>
      </div>
    );
  }

  const handleFeedClick = (feedData: { id: number; title: string }) => {
    const feed: Feed = {
      id: feedData.id,
      title: feedData.title,
      url: '',
      categoryId: 0,
      userId: 0,
      createdAt: '',
      updatedAt: ''
    };
    onFeedSelect(feed);
  };

  return (
    <div className="index-view">
      <div className="index-header">
        <h2>Index</h2>
      </div>
      <div className="index-content">
        {indexData.map((category) => (
          <div key={category.id} className="index-category">
            <div className="index-category-header">
              {category.name}
            </div>
            <div className="index-feeds-list">
              {category.feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="index-feed-item"
                  onClick={() => handleFeedClick({ id: feed.id, title: feed.title })}
                >
                  <div className="index-feed-info">
                    <div className="index-feed-title">{feed.title}</div>
                    {feed.lastFetchedAt && (
                      <div className="index-feed-meta">
                        Last updated: {new Date(feed.lastFetchedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="index-feed-stats">
                    <span className={`index-unread-badge ${feed.unreadCount === 0 ? 'zero' : ''}`}>
                      {feed.unreadCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IndexView;
