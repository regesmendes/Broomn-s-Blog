'use client';

import { useState, useRef } from 'react';
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

export default function NewPostPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = getToken() || '';
    const tagsArray = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await api.createPost(
        {
          title: form.title,
          content: form.content,
          excerpt: form.excerpt || undefined,
          coverImage: form.coverImage || undefined,
          tags: tagsArray.length > 0 ? tagsArray : undefined,
          status: form.status,
          publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined,
        },
        token
      );
      router.push('/admin/posts');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create post.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">New Post</h1>

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
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-gray-900 px-6 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Post'}
        </button>
      </form>
    </div>
  );
}
