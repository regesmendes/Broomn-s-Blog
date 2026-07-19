'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import type { MediaItem, MediaDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const { getToken } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      const result = await api.getMedia(token, { page, limit: 10, search: search || undefined });
      setMedia(result.data);
      setTotalPages(result.meta.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [getToken, page, search]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const token = getToken();
    if (!token) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.uploadMedia(file, token);
      }
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelect = async (item: MediaItem) => {
    const token = getToken();
    if (!token) return;
    try {
      const detail = await api.getMediaById(item.id, token);
      setSelectedDetail(detail);
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media details');
    }
  };

  const handleDelete = async () => {
    if (!selectedDetail) return;
    const token = getToken();
    if (!token) return;
    try {
      await api.deleteMedia(selectedDetail.id, token);
      setSelectedDetail(null);
      setConfirmDelete(false);
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete media');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Media Library</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 p-8 text-center transition-colors hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/30"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <p className="text-emerald-700 dark:text-emerald-300">Uploading...</p>
        ) : (
          <>
            <p className="text-lg font-medium text-emerald-700 dark:text-emerald-300">
              Drop images here or click to upload
            </p>
            <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
              Accepts image files (PNG, JPG, GIF, WebP)
            </p>
          </>
        )}
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search images by filename..."
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {loading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading media...</p>
          ) : media.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{search ? 'No images match your search.' : 'No media uploaded yet.'}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {media.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`cursor-pointer group relative overflow-hidden rounded-lg border text-left transition-all hover:shadow-md ${
                    selectedDetail?.id === item.id
                      ? 'border-emerald-500 ring-2 ring-emerald-500'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700">
                    <img
                      src={item.url}
                      alt={item.originalName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                      {item.originalName}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(item.size)}
                      </span>
                      {item.usageCount > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {item.usageCount} use{item.usageCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedDetail && (
          <div className="w-80 shrink-0 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700">
              <img
                src={selectedDetail.url}
                alt={selectedDetail.originalName}
                className="w-full object-contain"
                style={{ maxHeight: '240px' }}
              />
            </div>

            <h3 className="truncate font-medium text-gray-900 dark:text-white">
              {selectedDetail.originalName}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatFileSize(selectedDetail.size)} · {selectedDetail.mimeType}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Uploaded {new Date(selectedDetail.createdAt).toLocaleDateString()}
            </p>

            {/* Posts using this image */}
            {selectedDetail.posts.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Used in {selectedDetail.posts.length} post{selectedDetail.posts.length !== 1 ? 's' : ''}:
                </h4>
                <ul className="mt-1 space-y-1">
                  {selectedDetail.posts.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/posts/${post.slug}`}
                        className="text-sm text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {post.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Copy URL button */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedDetail.url);
                  alert('URL copied to clipboard!');
                }}
                className="flex-1 cursor-pointer rounded-md border border-emerald-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900"
              >
                📋 Copy URL
              </button>

              {!confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex-1 cursor-pointer rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  🗑 Delete
                </button>
              )}
            </div>

            {/* Delete confirmation */}
            {confirmDelete && (
              <div className="mt-3 space-y-2">
                {selectedDetail.posts.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ This image is used in {selectedDetail.posts.length} post{selectedDetail.posts.length !== 1 ? 's' : ''}. Deleting it will leave broken references.
                  </p>
                )}
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex-1 cursor-pointer rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedDetail(null)}
              className="mt-4 w-full cursor-pointer text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Close panel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
