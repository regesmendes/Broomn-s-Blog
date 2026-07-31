import { getTranslations } from 'next-intl/server';
import { resolveHtmlEmbeds } from '@/lib/htmlEmbeds';

interface PostContentProps {
  content: string;
  // True when an /en/ reader is seeing the Portuguese original because no
  // English translation has been authored yet (post/about/support).
  isPtFallback?: boolean;
}

export async function PostContent({ content, isPtFallback }: PostContentProps) {
  const t = await getTranslations('post');

  return (
    <>
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
