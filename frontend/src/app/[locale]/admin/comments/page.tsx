'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import api, { AdminComment, Comment } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Filter = 'pending' | 'approved' | 'all';

interface CommentCardProps {
  comment: Comment;
  postSlug?: string;
  postTitle?: string;
  nested?: boolean;
  onApprove: (id: string, approved: boolean) => void;
  onDelete: (id: string) => void;
  replyingId: string | null;
  replyContent: string;
  submittingReply: boolean;
  onReplyClick: (id: string) => void;
  onReplyContentChange: (value: string) => void;
  onSubmitReply: (parentId: string) => void;
  onCancelReply: () => void;
}

function CommentCard({
  comment,
  postSlug,
  postTitle,
  nested = false,
  onApprove,
  onDelete,
  replyingId,
  replyContent,
  submittingReply,
  onReplyClick,
  onReplyContentChange,
  onSubmitReply,
  onCancelReply,
}: CommentCardProps) {
  return (
    <div
      className={
        nested
          ? 'border-l-2 border-gray-200 pl-4 dark:border-gray-700'
          : 'rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800'
      }
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
        <div className="flex gap-2">
          {comment.isOwnerReply && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              Reply as Broomn
            </span>
          )}
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
      </div>

      {/* Post context — only on the top-level card, not on nested replies */}
      {!nested && postSlug && postTitle && (
        <div className="mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">on </span>
          <Link
            href={`/posts/${postSlug}`}
            className="text-xs text-emerald-800 hover:text-emerald-600 hover:underline visited:text-emerald-800 dark:text-emerald-200 dark:hover:text-emerald-400 dark:visited:text-emerald-200"
          >
            {postTitle}
          </Link>
        </div>
      )}

      {/* Content */}
      <p className="mb-3 text-gray-700 dark:text-gray-300">{comment.content}</p>

      {/* Actions */}
      <div className="flex items-center gap-4 text-sm">
        {!comment.approved && (
          <button
            onClick={() => onApprove(comment.id, true)}
            className="cursor-pointer text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
          >
            ✓ Approve
          </button>
        )}
        {comment.approved && (
          <button
            onClick={() => onApprove(comment.id, false)}
            className="cursor-pointer text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
          >
            ↩ Reject
          </button>
        )}
        <button
          onClick={() => onDelete(comment.id)}
          className="cursor-pointer text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          ✕ Delete
        </button>
        {!comment.parentId && (
          <button
            onClick={() => onReplyClick(comment.id)}
            className="cursor-pointer text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            ↩ Reply as Broomn
          </button>
        )}
      </div>

      {replyingId === comment.id && (
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
          <textarea
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder="Reply as Broomn..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onSubmitReply(comment.id)}
              disabled={submittingReply || !replyContent.trim()}
              className="cursor-pointer rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {submittingReply ? 'Posting...' : 'Post Reply'}
            </button>
            <button
              onClick={onCancelReply}
              className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              nested
              onApprove={onApprove}
              onDelete={onDelete}
              replyingId={replyingId}
              replyContent={replyContent}
              submittingReply={submittingReply}
              onReplyClick={onReplyClick}
              onReplyContentChange={onReplyContentChange}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [total, setTotal] = useState(0);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
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
      // The list is now nested (top-level comments + their replies), and
      // either could be the one just approved/rejected — reload rather than
      // trying to patch a possibly-nested row in place.
      await loadComments();
    } catch {
      console.error('Failed to update comment');
    }
  }

  async function handleReply(parentId: string) {
    if (!replyContent.trim()) return;
    setSubmittingReply(true);
    try {
      const token = getToken() || '';
      await api.replyAsBroomn(parentId, replyContent.trim(), token);
      setReplyingId(null);
      setReplyContent('');
      // Reload so the new reply shows up nested under its parent.
      await loadComments();
    } catch (err) {
      console.error('Failed to post reply', err);
      alert('Failed to post reply: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this comment permanently?')) return;
    try {
      const token = getToken() || '';
      await api.deleteComment(id, token);
      // A deleted top-level comment takes its nested replies with it
      // (cascade, server-side) — reload rather than filtering just the id.
      await loadComments();
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
            <CommentCard
              key={comment.id}
              comment={comment}
              postSlug={comment.post.slug}
              postTitle={comment.post.title}
              onApprove={handleApprove}
              onDelete={handleDelete}
              replyingId={replyingId}
              replyContent={replyContent}
              submittingReply={submittingReply}
              onReplyClick={(id) => {
                setReplyingId(replyingId === id ? null : id);
                setReplyContent('');
              }}
              onReplyContentChange={setReplyContent}
              onSubmitReply={handleReply}
              onCancelReply={() => {
                setReplyingId(null);
                setReplyContent('');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
