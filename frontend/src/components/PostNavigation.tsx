'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { AdjacentPost } from '@/lib/api';

interface PostNavigationProps {
  previous: AdjacentPost | null;
  next: AdjacentPost | null;
}

function localizedTitle(post: AdjacentPost, locale: string): string {
  return locale === 'en' ? (post.titleEn ?? post.title) : post.title;
}

export function PostNavigation({ previous, next }: PostNavigationProps) {
  const t = useTranslations('post');
  const locale = useLocale();

  if (!previous && !next) return null;

  return (
    <nav className="flex items-start justify-between gap-4 border-t border-emerald-200/50 pt-6 dark:border-emerald-900/50">
      <div className="flex-1">
        {previous && (
          <Link
            href={`/posts/${previous.slug}`}
            className="block text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              ← {t('previousPost')}
            </span>
            {localizedTitle(previous, locale)}
          </Link>
        )}
      </div>

      <div className="flex-1 text-right">
        {next && (
          <Link
            href={`/posts/${next.slug}`}
            className="block text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {t('nextPost')} →
            </span>
            {localizedTitle(next, locale)}
          </Link>
        )}
      </div>
    </nav>
  );
}
