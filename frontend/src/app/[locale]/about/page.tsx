import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import { PostContent } from '@/components/PostContent';
import { TranslationProvider } from '@/components/TranslationProvider';
import { TranslateControls } from '@/components/TranslateControls';
import { Divider } from '@/components/Divider';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about');

  try {
    const about = await api.getAbout();
    return {
      title: `${t('title')} | Blog do Broomn`,
      description: about.content.replace(/<[^>]*>/g, '').slice(0, 160),
    };
  } catch {
    return { title: `${t('title')} | Blog do Broomn` };
  }
}

export default async function AboutPage() {
  const t = await getTranslations('about');
  const about = await api.getAbout();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <TranslationProvider content={about.content}>
        <header className="relative mb-10 text-center">
          <div className="absolute top-0 right-0">
            <TranslateControls />
          </div>

          <h1 className="mb-4 text-4xl font-bold text-emerald-900 dark:text-emerald-100 md:text-5xl">
            {t('title')}
          </h1>
        </header>

        <Divider />

        <PostContent />
      </TranslationProvider>

      <div className="mt-8 border-t border-emerald-200/50 pt-8 dark:border-emerald-900/50">
        <Link href="/" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300">
          {t('backHome')}
        </Link>
      </div>
    </article>
  );
}
