import React, { useState } from 'react';
import { Category } from '../types';
import { feedsApi } from '../services/api';

interface AddFeedModalProps {
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

const AddFeedModal: React.FC<AddFeedModalProps> = ({
  categories,
  onClose,
  onSuccess,
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number>(
    categories.length > 0 ? categories[0].id : 0
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Feed URL is required');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    try {
      await feedsApi.create({
        url: url.trim(),
        title: title.trim() || undefined,
        categoryId,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add feed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add New Feed</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Feed URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              required
            />
          </div>

          <div className="form-group">
            <label>Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Feed title"
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
              {loading ? 'Adding...' : 'Add Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFeedModal;
