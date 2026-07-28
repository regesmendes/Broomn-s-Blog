import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import { PostContent } from '@/components/PostContent';
import { Divider } from '@/components/Divider';
import { buildAlternates } from '@/lib/seo';
import { localizeHtml, localizePlainText } from '@/lib/localizeContent';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('support'), getLocale()]);
  const alternates = buildAlternates(locale, '/support');

  try {
    const support = await api.getSupport();
    const description = await localizePlainText(
      support.content.replace(/<[^>]*>/g, '').slice(0, 160),
      locale
    );
    return {
      title: `${t('title')} | Blog do Broomn`,
      description,
      alternates,
    };
  } catch {
    return { title: `${t('title')} | Blog do Broomn`, alternates };
  }
}

export default async function SupportPage() {
  const [t, locale] = await Promise.all([getTranslations('support'), getLocale()]);
  const support = await api.getSupport();
  const { content, translated, error: translationError } = await localizeHtml(support.content, locale);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="mb-4 text-4xl font-bold text-emerald-900 dark:text-emerald-100 md:text-5xl">
          {t('title')}
        </h1>
      </header>

      <Divider />

      <PostContent content={content} translated={translated} translationError={translationError} />

      <div className="mt-8 border-t border-emerald-200/50 pt-8 dark:border-emerald-900/50">
        <Link href="/" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300">
          {t('backHome')}
        </Link>
      </div>
    </article>
  );
}
