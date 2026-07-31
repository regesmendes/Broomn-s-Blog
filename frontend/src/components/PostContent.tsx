import { getTranslations } from 'next-intl/server';
import { resolveHtmlEmbeds } from '@/lib/htmlEmbeds';

interface PostContentProps {
  content: string;
  translated?: boolean;
  translationError?: string;
  // Set on posts only: true when an /en/ reader is seeing the Portuguese
  // original because no English translation has been authored yet.
  isPtFallback?: boolean;
}

export async function PostContent({ content, translated, translationError, isPtFallback }: PostContentProps) {
  const t = await getTranslations('post');

  return (
    <>
      {(translated || translationError) && (
        <div className="mb-6">
          {translated && (
            <p className="text-xs italic text-gray-500 dark:text-gray-400">
              {t('translatedDisclaimer')}
            </p>
          )}

          {translationError && (
            <p className="text-xs text-red-600 dark:text-red-400">{translationError}</p>
          )}
        </div>
      )}

      {isPtFallback && (
        <p className="mb-6 text-xs italic text-gray-500 dark:text-gray-400">
          {t('ptFallbackBadge')}
        </p>
      )}

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: resolveHtmlEmbeds(content) }}
      />
    </>
  );
}
