'use client';

import { useState, useEffect } from 'react';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ImagePickerModal } from '@/components/ImagePickerModal';

export default function AdminAboutPage() {
  const { getToken } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  useEffect(() => {
    loadAbout();
  }, []);

  const loadAbout = async () => {
    try {
      const about = await api.getAbout();
      setContent(about.content);
    } catch {
      setError('Failed to load the About page.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = getToken() || '';
      await api.updateAbout(content, token);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to save the About page.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Loading...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">About Page</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content *
          </label>
          <div className="mt-1">
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write the About page content..."
              onImagePick={() => setImagePickerOpen(true)}
            />
            <ImagePickerModal
              isOpen={imagePickerOpen}
              onClose={() => setImagePickerOpen(false)}
              onSelect={(url) => {
                setContent((prev) => prev + `<img src="${url}" alt="" />`);
                setImagePickerOpen(false);
              }}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gray-900 px-6 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}
