import { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import api from '@/lib/api';
import { Post } from '@/lib/api';
import { HeroSection } from '@/components/HeroSection';
import { Divider } from '@/components/Divider';
import { TranslatablePostCard } from '@/components/TranslatablePostCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Broomn's Blog",
  description: 'Chronicles from Broomn, the druid storyteller. A place for stories worth sharing around the fire.',
  openGraph: {
    title: "Broomn's Blog",
    description: 'Chronicles from Broomn, the druid storyteller. A place for stories worth sharing around the fire.',
    type: 'website',
  },
};

export default async function HomePage() {
  const t = await getTranslations('home');
  const locale = await getLocale();
  let posts: Post[] = [];
  let error = false;

  try {
    const result = await api.getPosts();
    posts = result.data;
  } catch {
    error = true;
  }

  return (
    <>
      <HeroSection />
      <Divider />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">{t('latestPosts')}</h2>

        {error && (
          <p className="text-gray-500 dark:text-gray-400">{t('loadError')}</p>
        )}

        {!error && posts.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">{t('noPosts')}</p>
        )}

        <div className="grid gap-8">
          {posts.map((post) => (
            <TranslatablePostCard
              key={post.id}
              post={post}
              dateLocale={locale === 'pt' ? 'pt-BR' : 'en-US'}
            />
          ))}
        </div>
      </div>
    </>
  );
}
