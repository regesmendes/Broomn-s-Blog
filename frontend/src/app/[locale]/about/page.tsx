import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import { PostContent } from '@/components/PostContent';

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
      <header className="mb-10 text-center">
        <h1 className="mb-4 text-4xl font-bold text-emerald-900 dark:text-emerald-100 md:text-5xl">
          {t('title')}
        </h1>
      </header>

      {/* Decorative divider before content */}
      <div className="mb-8 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/divider.png" alt="" className="h-10 w-auto opacity-60 dark:opacity-40" />
      </div>

      <PostContent content={about.content} />

      <div className="mt-8 border-t border-emerald-200/50 pt-8 dark:border-emerald-900/50">
        <Link href="/" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300">
          {t('backHome')}
        </Link>
      </div>
    </article>
  );
}
