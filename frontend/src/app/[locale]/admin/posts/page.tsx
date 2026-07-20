'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import api, { Post } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const { getToken } = useAuth();

  useEffect(() => {
    loadPosts();
  }, [statusFilter]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const token = getToken() || '';
      const { data } = await api.getAdminPosts(token, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setPosts(data);
    } catch {
      console.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    const token = getToken() || '';
    try {
      await api.deletePost(id, token);
      setPosts(posts.filter((p) => p.id !== id));
    } catch {
      console.error('Failed to delete post');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Posts</h1>
        <Link
          href="/admin/posts/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          New Post
        </Link>
      </div>

      <div className="mb-4 flex gap-1">
        {(['ALL', 'DRAFT', 'PUBLISHED'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === filter
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {filter === 'ALL' ? 'All' : filter === 'DRAFT' ? 'Draft' : 'Published'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading posts...</p>
      ) : (
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Title</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {posts.map((post) => (
              <tr key={post.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  <Link href={`/admin/posts/${post.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                    {post.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      post.status === 'PUBLISHED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {post.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="cursor-pointer text-red-500 hover:text-red-700"
                    title="Delete post"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {posts.length === 0 && (
          <p className="p-4 text-center text-gray-500 dark:text-gray-400">No posts found.</p>
        )}
      </div>
      )}
    </div>
  );
}
