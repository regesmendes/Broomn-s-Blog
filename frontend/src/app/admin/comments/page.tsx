'use client';

import { useEffect, useState } from 'react';
import api, { Comment } from '@/lib/api';

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, []);

  const getToken = () => localStorage.getItem('accessToken') || '';

  const loadComments = async () => {
    try {
      const data = await api.getAllComments(getToken());
      setComments(data);
    } catch {
      console.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const updated = await api.approveComment(id, getToken());
      setComments(comments.map((c) => (c.id === id ? updated : c)));
    } catch {
      console.error('Failed to approve comment');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.deleteComment(id, getToken());
      setComments(comments.filter((c) => c.id !== id));
    } catch {
      console.error('Failed to delete comment');
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading comments...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Comment Moderation</h1>

      {comments.length === 0 ? (
        <p className="text-gray-500">No comments to moderate.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">
                    {comment.authorName}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {comment.authorEmail}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    comment.approved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {comment.approved ? 'Approved' : 'Pending'}
                </span>
              </div>

              <p className="mb-3 text-gray-700">{comment.content}</p>

              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  {new Date(comment.createdAt).toLocaleDateString('pt-BR')}
                </span>

                {!comment.approved && (
                  <button
                    onClick={() => handleApprove(comment.id)}
                    className="text-green-600 hover:text-green-800"
                  >
                    Approve
                  </button>
                )}

                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
