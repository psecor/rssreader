import React from 'react';
import { HistoryItem } from '../types';

interface HistoryViewProps {
  historyItems: HistoryItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({
  historyItems,
  loading,
  searchQuery,
  onSearchChange,
}) => {
  const formatReadAt = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="history-view">
      {/* Search */}
      <div className="history-search">
        <input
          type="text"
          className="history-search-input"
          placeholder="Search article titles..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="loading">Loading...</div>
      ) : historyItems.length === 0 ? (
        <div className="empty-state">
          <p>{searchQuery ? 'No articles match your search' : 'No reading history yet'}</p>
          <p className="empty-subtitle">
            {searchQuery ? 'Try different keywords' : 'Articles you read will appear here'}
          </p>
        </div>
      ) : (
        <div className="history-list">
          {historyItems.map((item) => (
            <div
              key={`${item.id}-${item.readAt}`}
              className="history-item"
              onClick={() => window.open(item.link, '_blank', 'noopener,noreferrer')}
            >
              {item.thumbnail && (
                <img className="history-thumb" src={item.thumbnail} alt="" loading="lazy" />
              )}
              <div className="history-item-info">
                <div className="history-item-title">{item.title}</div>
                <div className="history-item-meta">
                  {item.feed && (
                    <span className="history-item-source">{item.feed.title}</span>
                  )}
                  <span className="history-item-date">{formatReadAt(item.readAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryView;
