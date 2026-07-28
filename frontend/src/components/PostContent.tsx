import { getTranslations } from 'next-intl/server';

interface PostContentProps {
  content: string;
  translated?: boolean;
  translationError?: string;
}

export async function PostContent({ content, translated, translationError }: PostContentProps) {
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

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </>
  );
}
