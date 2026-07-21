'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Post } from '@/lib/api';
import { translatePlainText } from '@/lib/translate';

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
      const translatedTitle = await translatePlainText(post.title, 'pt|en');
      setTitle(translatedTitle);

      // Translate excerpt if it exists
      if (post.excerpt) {
        const translatedExcerpt = await translatePlainText(post.excerpt, 'pt|en');
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
    <article className="flex gap-4 overflow-hidden rounded-lg bg-white shadow-sm transition hover:shadow-md dark:bg-gray-800">
      {post.coverImage && (
        <Link href={`/posts/${post.slug}`} className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage}
            alt={post.title}
            className="h-full w-32 object-cover sm:w-40"
          />
        </Link>
      )}

      <div className={`min-w-0 flex-1 ${post.coverImage ? 'py-4 pr-4' : 'p-4'}`}>
        {/* Color/hover/visited live on the anchor itself, not the heading —
            :visited can only restyle the link element it matches, never a
            descendant, so an h2-level color class would silently never
            apply once the link had been visited. */}
        <Link
          href={`/posts/${post.slug}`}
          className="text-emerald-800 hover:text-emerald-600 visited:text-emerald-800 dark:text-emerald-200 dark:hover:text-emerald-400 dark:visited:text-emerald-200"
        >
          <h2 className="mb-2 text-xl font-semibold">
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
      </div>
    </article>
  );
}
