'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Post } from '@/lib/api';

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

interface TranslatablePostCardProps {
  post: Post;
  dateLocale: string;
}

export function TranslatablePostCard({ post, dateLocale }: TranslatablePostCardProps) {
  const locale = useLocale();
  const t = useTranslations('home');
  const [title, setTitle] = useState(post.title);
  const [excerpt, setExcerpt] = useState(post.excerpt || '');
  const [translating, setTranslating] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (locale === 'en') {
      translateCard();
    }
  }, [locale]);

  async function translateCard() {
    setTranslating(true);
    setFailed(false);

    try {
      // Translate title
      const translatedTitle = await translateText(post.title);
      setTitle(translatedTitle);

      // Translate excerpt if it exists
      if (post.excerpt) {
        const translatedExcerpt = await translateText(post.excerpt);
        setExcerpt(translatedExcerpt);
      }
    } catch {
      setFailed(true);
      // Keep original text on failure
      setTitle(post.title);
      setExcerpt(post.excerpt || '');
    } finally {
      setTranslating(false);
    }
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <Link href={`/posts/${post.slug}`}>
        <h2 className="mb-2 text-xl font-semibold text-gray-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400">
          {translating ? (
            <span className="inline-block animate-pulse text-gray-400 dark:text-gray-500">{post.title}</span>
          ) : (
            title
          )}
        </h2>
      </Link>

      {(excerpt || post.excerpt) && (
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          {translating ? (
            <span className="animate-pulse text-gray-400 dark:text-gray-500">{post.excerpt}</span>
          ) : (
            excerpt
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-500">
        {post.publishedAt && (
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString(dateLocale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        )}

        {post.tags.length > 0 && (
          <div className="flex gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {failed && (
          <span className="text-xs italic text-amber-600 dark:text-amber-400">
            {t('translationUnavailable')}
          </span>
        )}
      </div>
    </article>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────────

async function translateText(text: string): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    langpair: 'pt|en',
  });

  const response = await fetch(`${MYMEMORY_URL}?${params}`);

  if (!response.ok) {
    throw new Error('Translation unavailable');
  }

  const data = await response.json();

  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'Translation failed');
  }

  return data.responseData.translatedText;
}
