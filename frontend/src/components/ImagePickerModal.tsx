'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import type { MediaItem } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function ImagePickerModal({ isOpen, onClose, onSelect }: ImagePickerModalProps) {
  const { getToken } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      const result = await api.getMedia(token, { page, limit: 12, search: search || undefined });
      setMedia(result.data);
      setTotalPages(result.meta.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [getToken, page, search]);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
      setError(null);
    }
  }, [isOpen, loadMedia]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const token = getToken();
    if (!token) return;

    setUploading(true);
    setError(null);
    try {
      let lastUploaded: MediaItem | null = null;
      for (const file of Array.from(files)) {
        lastUploaded = await api.uploadMedia(file, token);
      }
      // Auto-select the last uploaded image
      if (lastUploaded) {
        onSelect(lastUploaded.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelect = (item: MediaItem) => {
    onSelect(item.url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Select Image
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Upload button */}
        <div className="border-b border-gray-200 px-6 py-3 dark:border-gray-700">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload New Image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search images..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400">Loading media...</p>
          ) : media.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">
              {search ? 'No images match your search.' : 'No images yet. Upload one to get started.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {media.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 transition-all hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500 dark:border-gray-700 dark:bg-gray-700"
                >
                  <img
                    src={item.url}
                    alt={item.originalName}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-xs text-white">{item.originalName}</p>
                  </div>
                </button>
              ))}
            </div>
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="cursor-pointer rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    ←
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{page}/{totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="cursor-pointer rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
