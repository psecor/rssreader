import React, { useState } from 'react';
import { Category, Feed } from '../types';
import { feedsApi } from '../services/api';

interface EditFeedModalProps {
  feed: Feed;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

const EditFeedModal: React.FC<EditFeedModalProps> = ({
  feed,
  categories,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState(feed.title);
  const [categoryId, setCategoryId] = useState(feed.categoryId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Feed title is required');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    try {
      await feedsApi.update(feed.id, {
        title: title.trim(),
        categoryId,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update feed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Feed Settings</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Feed Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Feed title"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Feed URL (read-only)</label>
            <input
              type="text"
              value={feed.url}
              disabled
              className="readonly-input"
            />
          </div>

          <div className="form-group">
            <label>Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="primary">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFeedModal;
