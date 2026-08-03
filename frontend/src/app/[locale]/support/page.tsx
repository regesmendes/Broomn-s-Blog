import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import { PostContent } from '@/components/PostContent';
import { Divider } from '@/components/Divider';
import { buildAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('support'), getLocale()]);

  try {
    const support = await api.getSupport();
    const hasEnTranslation = !!support.contentEn;
    const alternates = buildAlternates(locale, '/support', {
      includeEn: hasEnTranslation,
      canonicalLocale: locale === 'en' && !hasEnTranslation ? 'pt' : locale,
    });
    const content = locale === 'en' ? (support.contentEn ?? support.content) : support.content;
    const description = content.replace(/<[^>]*>/g, '').slice(0, 160);

    return {
      title: `${t('title')} | Blog do Broomn`,
      description,
      alternates,
      ...(locale === 'en' && !hasEnTranslation && { robots: { index: false } }),
    };
  } catch {
    const alternates = buildAlternates(locale, '/support');
    return { title: `${t('title')} | Blog do Broomn`, alternates };
  }
}

export default async function SupportPage() {
  const [t, locale] = await Promise.all([getTranslations('support'), getLocale()]);
  const support = await api.getSupport();
  const hasEnTranslation = !!support.contentEn;
  const isPtFallback = locale === 'en' && !hasEnTranslation;
  const content = locale === 'en' ? (support.contentEn ?? support.content) : support.content;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="mb-4 text-4xl font-bold text-emerald-900 dark:text-emerald-100 md:text-5xl">
          {t('title')}
        </h1>
      </header>

      <Divider />

      <PostContent content={content} isPtFallback={isPtFallback} />

      <div className="mt-8 border-t border-emerald-200/50 pt-8 dark:border-emerald-900/50">
        <Link href="/" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300">
          {t('backHome')}
        </Link>
      </div>
    </article>
  );
}
