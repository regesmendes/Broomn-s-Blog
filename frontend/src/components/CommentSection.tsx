'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import api, { ApiError, Comment } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface CommentSectionProps {
  postId: string;
}

export function CommentSection({ postId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const { isAuthenticated, user, getToken } = useAuth();
  const t = useTranslations('post');

  useEffect(() => {
    loadComments();
  }, [postId]);

  async function loadComments() {
    try {
      const { data } = await api.getComments(postId);
      setComments(data);
    } catch {
      // silently fail — comments are optional
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const token = getToken() || '';
      const newComment = await api.createComment(postId, content.trim(), token);
      // Comment might need approval — show optimistic message
      setContent('');
      // If auto-approved, add to list; otherwise show pending message
      if (newComment.approved) {
        setComments([newComment, ...comments]);
      } else {
        setMessage({ text: t('awaitingModeration'), type: 'success' });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setMessage({ text: t('commentLimitReached'), type: 'error' });
      } else {
        setMessage({ text: err instanceof Error ? err.message : 'Failed to post comment', type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-12 border-t border-gray-200 pt-8 dark:border-gray-700">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">{t('comments')}</h2>

      {/* Comment form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="mb-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('writeComment')}
              rows={3}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('commentingAs')} {user?.name}
            </span>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              {submitting ? t('posting') : t('postComment')}
            </button>
          </div>
          {message && (
            <p className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {message.text}
            </p>
          )}
        </form>
      ) : (
        <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/auth/login" className="text-emerald-600 hover:underline dark:text-emerald-400">{t('signInToComment')}</Link>
        </p>
      )}

      {/* Comments list */}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">...</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">{t('noComments')}</p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {comment.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comment.user.avatarUrl}
                    alt={comment.user.name}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                    {comment.user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {comment.user.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(comment.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
