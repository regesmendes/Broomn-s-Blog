'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import api, { AdminComment } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Filter = 'pending' | 'approved' | 'all';

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [total, setTotal] = useState(0);
  const { getToken } = useAuth();

  useEffect(() => {
    loadComments();
  }, [filter]);

  async function loadComments() {
    setLoading(true);
    try {
      const approved = filter === 'pending' ? 'false' : filter === 'approved' ? 'true' : undefined;
      const token = getToken() || '';
      const result = await api.getAdminComments(token, { approved });
      setComments(result.data);
      setTotal(result.meta.total);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string, approved: boolean) {
    try {
      const token = getToken() || '';
      await api.approveComment(id, approved, token);
      // Remove from list or update status
      if (filter === 'pending' && approved) {
        setComments(comments.filter((c) => c.id !== id));
        setTotal(total - 1);
      } else if (filter === 'approved' && !approved) {
        setComments(comments.filter((c) => c.id !== id));
        setTotal(total - 1);
      } else {
        setComments(comments.map((c) => (c.id === id ? { ...c, approved } : c)));
      }
    } catch {
      console.error('Failed to update comment');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this comment permanently?')) return;
    try {
      const token = getToken() || '';
      await api.deleteComment(id, token);
      setComments(comments.filter((c) => c.id !== id));
      setTotal(total - 1);
    } catch (err) {
      console.error('Failed to delete comment', err);
      alert('Failed to delete: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Comment Moderation</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition ${
              filter === tab.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Count */}
      {!loading && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {total} comment{total !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Loading */}
      {loading && <p className="text-gray-500 dark:text-gray-400">Loading...</p>}

      {/* Empty state */}
      {!loading && comments.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">
          {filter === 'pending' ? 'No comments awaiting moderation.' : 'No comments found.'}
        </p>
      )}

      {/* Comments list */}
      {!loading && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Header */}
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {comment.user.name}
                  </span>
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(comment.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    comment.approved
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                  }`}
                >
                  {comment.approved ? 'Approved' : 'Pending'}
                </span>
              </div>

              {/* Post context */}
              <div className="mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">on </span>
                <Link
                  href={`/posts/${comment.post.slug}`}
                  className="text-xs text-emerald-800 hover:text-emerald-600 hover:underline visited:text-emerald-800 dark:text-emerald-200 dark:hover:text-emerald-400 dark:visited:text-emerald-200"
                >
                  {comment.post.title}
                </Link>
              </div>

              {/* Content */}
              <p className="mb-3 text-gray-700 dark:text-gray-300">{comment.content}</p>

              {/* Actions */}
              <div className="flex items-center gap-4 text-sm">
                {!comment.approved && (
                  <button
                    onClick={() => handleApprove(comment.id, true)}
                    className="cursor-pointer text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                  >
                    ✓ Approve
                  </button>
                )}
                {comment.approved && (
                  <button
                    onClick={() => handleApprove(comment.id, false)}
                    className="cursor-pointer text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                  >
                    ↩ Reject
                  </button>
                )}
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="cursor-pointer text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  ✕ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
