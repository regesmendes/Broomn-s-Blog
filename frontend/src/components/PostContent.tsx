'use client';

import { useTranslations } from 'next-intl';
import { useTranslatedContent } from '@/lib/useTranslatedContent';

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  const { displayContent, isTranslated, translating, error } = useTranslatedContent(content);
  const t = useTranslations('post');

  return (
    <>
      {(translating || isTranslated || error) && (
        <div className="mb-6">
          {translating && (
            <span className="text-sm italic text-gray-500 dark:text-gray-400">
              {t('translating')}
            </span>
          )}

          {isTranslated && (
            <p className="text-xs italic text-gray-500 dark:text-gray-400">
              {t('translatedDisclaimer')}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
    </>
  );
}
