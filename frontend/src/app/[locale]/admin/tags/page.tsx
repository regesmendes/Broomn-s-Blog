'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { ApiError } from '@/lib/api';
import type { TagWithCount } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function TagsPage() {
  const { getToken } = useAuth();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getTags();
      setTags(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const startRename = (tag: TagWithCount) => {
    setConfirmDeleteId(null);
    setEditingId(tag.id);
    setEditValue(tag.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveRename = async (id: string) => {
    const token = getToken();
    if (!token || !editValue.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await api.renameTag(id, editValue.trim(), token);
      setEditingId(null);
      setEditValue('');
      await loadTags();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to rename tag');
    } finally {
      setSaving(false);
    }
  };

  const startDelete = (id: string) => {
    setEditingId(null);
    setConfirmDeleteId(id);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const confirmDelete = async (id: string) => {
    const token = getToken();
    if (!token) return;

    setDeleting(true);
    setError(null);
    try {
      await api.deleteTag(id, token);
      setConfirmDeleteId(null);
      await loadTags();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete tag');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Rename a typo&apos;d tag into an existing one to merge them, or delete a tag you no longer want. Both actions
          apply everywhere the tag is used, including already-published posts.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">
            dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading tags...</p>
      ) : tags.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No tags yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Posts</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tags.map((tag) => (
                <tr key={tag.id} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3 align-top">
                    {editingId === tag.id ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                        {editValue.trim() &&
                          tags.some(
                            (t) =>
                              t.id !== tag.id &&
                              t.name.toLowerCase() === editValue.trim().toLowerCase()
                          ) && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              A tag with this name already exists — saving will merge &quot;{tag.name}&quot; into it.
                            </p>
                          )}
                      </div>
                    ) : (
                      <span className="font-medium text-gray-900 dark:text-white">{tag.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-500 dark:text-gray-400">
                    {tag.postCount} post{tag.postCount !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {editingId === tag.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveRename(tag.id)}
                          disabled={saving || !editValue.trim()}
                          className="cursor-pointer rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelRename}
                          disabled={saving}
                          className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : confirmDeleteId === tag.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-red-600 dark:text-red-400">
                          {tag.postCount > 0
                            ? `Delete? Used by ${tag.postCount} post${tag.postCount !== 1 ? 's' : ''} — it'll be removed from all of them.`
                            : 'Delete this tag? This cannot be undone.'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmDelete(tag.id)}
                            disabled={deleting}
                            className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deleting ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={cancelDelete}
                            disabled={deleting}
                            className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startRename(tag)}
                          className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => startDelete(tag.id)}
                          className="cursor-pointer rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
