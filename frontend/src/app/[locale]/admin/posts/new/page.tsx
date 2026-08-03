'use client';

import { useState, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PostLocaleFields, PostLocaleFieldsHandle } from '@/components/PostLocaleFields';
import { ImagePickerModal } from '@/components/ImagePickerModal';
import { TagPicker } from '@/components/TagPicker';

interface PostFormData {
  title: string;
  titleEn: string;
  excerpt: string;
  excerptEn: string;
  content: string;
  contentEn: string;
  coverImage: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string;
}

export default function NewPostPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'content-pt' | 'content-en' | 'cover'>('content-pt');
  const localeFieldsRef = useRef<PostLocaleFieldsHandle>(null);
  const [form, setForm] = useState<PostFormData>({
    title: '',
    titleEn: '',
    excerpt: '',
    excerptEn: '',
    content: '',
    contentEn: '',
    coverImage: '',
    tags: [],
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

    try {
      await api.createPost(
        {
          title: form.title,
          titleEn: form.titleEn || undefined,
          content: form.content,
          contentEn: form.contentEn || undefined,
          excerpt: form.excerpt || undefined,
          excerptEn: form.excerptEn || undefined,
          coverImage: form.coverImage || undefined,
          tags: form.tags.length > 0 ? form.tags : undefined,
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
          <PostLocaleFields
            ref={localeFieldsRef}
            pt={{ title: form.title, excerpt: form.excerpt, content: form.content }}
            en={{ title: form.titleEn, excerpt: form.excerptEn, content: form.contentEn }}
            onChangePt={(next) =>
              setForm((prev) => ({ ...prev, title: next.title, excerpt: next.excerpt, content: next.content }))
            }
            onChangeEn={(next) =>
              setForm((prev) => ({ ...prev, titleEn: next.title, excerptEn: next.excerpt, contentEn: next.content }))
            }
            onRequestImagePick={(locale) => {
              setImagePickerTarget(locale === 'pt' ? 'content-pt' : 'content-en');
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
                localeFieldsRef.current?.insertImage(imagePickerTarget === 'content-pt' ? 'pt' : 'en', url);
              }
              setImagePickerOpen(false);
            }}
          />
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
          <div className="mt-1">
            <TagPicker value={form.tags} onChange={(tags) => setForm((prev) => ({ ...prev, tags }))} />
          </div>
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
