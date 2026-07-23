'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { RichTextEditor, RichTextEditorHandle } from '@/components/RichTextEditor';
import { ImagePickerModal } from '@/components/ImagePickerModal';

interface PostFormData {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  tags: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string;
}

const AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000;

function buildUpdatePayload(form: PostFormData) {
  const tagsArray = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    title: form.title,
    content: form.content,
    excerpt: form.excerpt || undefined,
    coverImage: form.coverImage || undefined,
    tags: tagsArray.length > 0 ? tagsArray : undefined,
    status: form.status,
    publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined,
  };
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  const { getToken, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successFadingOut, setSuccessFadingOut] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<Date | null>(null);
  const [autosaveFadingOut, setAutosaveFadingOut] = useState(false);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'content' | 'cover'>('content');
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [form, setForm] = useState<PostFormData>({
    title: '',
    excerpt: '',
    content: '',
    coverImage: '',
    tags: '',
    status: 'DRAFT',
    publishedAt: '',
  });

  // Refs mirror the latest form/saving state (and getToken) so the autosave
  // timer (self-perpetuating via setTimeout) always reads current values
  // instead of the closure it was originally armed with. Without
  // getTokenRef, the loop keeps calling whichever getToken was live at the
  // last (re)arm — missing every background token refresh in between — and
  // starts failing with 401s once that captured access token expires.
  const formRef = useRef(form);
  formRef.current = form;
  const savingRef = useRef(saving);
  savingRef.current = saving;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  // Snapshot of what's actually persisted server-side — an autosave tick
  // skips entirely if the form hasn't changed since this was last updated.
  const lastSavedFormRef = useRef<PostFormData | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading) {
      loadPost();
    }
    // Autosave only ever targets this one post — stop the timer on unmount
    // (navigating away) so it doesn't fire against an unmounted page.
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [postId, authLoading]);

  const scheduleAutosave = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(runAutosave, AUTOSAVE_INTERVAL_MS);
  };

  const runAutosave = async () => {
    // Always queue the next tick first, whether or not this one ends up
    // doing anything — a skipped or failed tick still retries in 3 minutes.
    scheduleAutosave();

    if (savingRef.current) return;

    const current = formRef.current;
    const lastSaved = lastSavedFormRef.current;
    if (lastSaved && JSON.stringify(current) === JSON.stringify(lastSaved)) return;

    setSaving(true);
    try {
      const token = getTokenRef.current() || '';
      await api.updatePost(postId, buildUpdatePayload(current), token);
      lastSavedFormRef.current = current;
      setAutosaveFailed(false);
      setAutosavedAt(new Date());
    } catch {
      setAutosaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const loadPost = async () => {
    try {
      const token = getToken() || '';
      const post = await api.getPostById(postId, token);
      const loadedForm: PostFormData = {
        title: post.title,
        excerpt: post.excerpt || '',
        content: post.content,
        coverImage: post.coverImage || '',
        tags: post.tags.map((t) => t.name).join(', '),
        status: post.status,
        publishedAt: post.publishedAt
          ? new Date(post.publishedAt).toISOString().slice(0, 16)
          : '',
      };
      setForm(loadedForm);
      lastSavedFormRef.current = loadedForm;
      scheduleAutosave();
    } catch {
      setError('Failed to load post.');
    } finally {
      setLoading(false);
    }
  };

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

  // Same fade treatment for the "Auto-saved at..." indicator.
  useEffect(() => {
    if (!autosavedAt) return;
    setAutosaveFadingOut(false);
    const fadeTimer = setTimeout(() => setAutosaveFadingOut(true), 3200);
    const hideTimer = setTimeout(() => setAutosavedAt(null), 3700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [autosavedAt]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const token = getToken() || '';

    try {
      await api.updatePost(postId, buildUpdatePayload(form), token);
      lastSavedFormRef.current = form;
      setAutosaveFailed(false);
      // Posts are typically edited several times before publishing — stay
      // here instead of redirecting to the list, so drafting isn't
      // interrupted by a trip back and forth. "Cancel" below is the
      // deliberate way to leave.
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update post.');
      }
    } finally {
      setSaving(false);
      // A manual save (successful or not) means recent activity — push the
      // next autosave tick out a full 3 minutes from now.
      scheduleAutosave();
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading post...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Edit Post</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>

        <div>
          <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Excerpt
          </label>
          <input
            id="excerpt"
            name="excerpt"
            type="text"
            value={form.excerpt}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content *
          </label>
          <div className="mt-1">
            <RichTextEditor
              ref={editorRef}
              content={form.content}
              onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
              placeholder="Start writing your post..."
              onImagePick={() => {
                setImagePickerTarget('content');
                setImagePickerOpen(true);
              }}
            />
            <ImagePickerModal
              isOpen={imagePickerOpen}
              onClose={() => setImagePickerOpen(false)}
              onSelect={(url) => {
                if (imagePickerTarget === 'cover') {
                  setForm((prev) => ({ ...prev, coverImage: url }));
                } else {
                  editorRef.current?.insertImage(url);
                }
                setImagePickerOpen(false);
              }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="coverImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Cover Image URL
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="coverImage"
              name="coverImage"
              type="url"
              value={form.coverImage}
              onChange={handleChange}
              className="block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={() => {
                setImagePickerTarget('cover');
                setImagePickerOpen(true);
              }}
              className="flex-shrink-0 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Browse
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tags (comma-separated)
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            value={form.tags}
            onChange={handleChange}
            placeholder="typescript, react, nextjs"
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>

          <div>
            <label htmlFor="publishedAt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Publish Date
            </label>
            <input
              id="publishedAt"
              name="publishedAt"
              type="datetime-local"
              value={form.publishedAt}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p
            className={`text-sm text-green-600 transition-opacity duration-500 dark:text-green-400 ${
              successFadingOut ? 'opacity-0' : 'opacity-100'
            }`}
          >
            Saved.
          </p>
        )}
        {autosavedAt && (
          <p
            className={`text-xs text-gray-500 transition-opacity duration-500 dark:text-gray-400 ${
              autosaveFadingOut ? 'opacity-0' : 'opacity-100'
            }`}
          >
            Auto-saved at {autosavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {autosaveFailed && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Auto-save failed — will retry in a few minutes.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-gray-900 px-6 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/posts')}
            className="rounded-md border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
