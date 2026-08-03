'use client';

import { useState, useEffect, useRef } from 'react';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ContentLocaleFields, ContentLocaleFieldsHandle } from '@/components/ContentLocaleFields';
import { ImagePickerModal } from '@/components/ImagePickerModal';

export default function AdminSupportPage() {
  const { getToken } = useAuth();
  const [content, setContent] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successFadingOut, setSuccessFadingOut] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'pt' | 'en'>('pt');
  const localeFieldsRef = useRef<ContentLocaleFieldsHandle>(null);

  useEffect(() => {
    loadSupport();
  }, []);

  // Auto-fade the manual-save success message: fully visible for a beat,
  // then a short CSS opacity fade, gone well within the requested 3-5s.
  useEffect(() => {
    if (!success) return;
    setSuccessFadingOut(false);
    const fadeTimer = setTimeout(() => setSuccessFadingOut(true), 3200);
    const hideTimer = setTimeout(() => setSuccess(false), 3700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [success]);

  const loadSupport = async () => {
    try {
      const support = await api.getSupport();
      setContent(support.content);
      setContentEn(support.contentEn || '');
    } catch {
      setError('Failed to load the Support page.');
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
      await api.updateSupport({ content, contentEn: contentEn || undefined }, token);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to save the Support page.');
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
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Support Page</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content *
          </label>
          <div className="mt-1">
            <ContentLocaleFields
              ref={localeFieldsRef}
              pt={content}
              en={contentEn}
              onChangePt={setContent}
              onChangeEn={setContentEn}
              onRequestImagePick={(locale) => {
                setImagePickerTarget(locale);
                setImagePickerOpen(true);
              }}
            />
            <ImagePickerModal
              isOpen={imagePickerOpen}
              onClose={() => setImagePickerOpen(false)}
              onSelect={(url) => {
                localeFieldsRef.current?.insertImage(imagePickerTarget, url);
                setImagePickerOpen(false);
              }}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && (
          <p
            className={`text-sm text-green-600 transition-opacity duration-500 dark:text-green-400 ${
              successFadingOut ? 'opacity-0' : 'opacity-100'
            }`}
          >
            Saved.
          </p>
        )}

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
