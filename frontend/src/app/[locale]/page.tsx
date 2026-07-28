import { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { HeroSection } from '@/components/HeroSection';
import { Divider } from '@/components/Divider';
import { PostList } from '@/components/PostList';
import { buildAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  return {
    title: "Blog do Broomn",
    description: 'Crônicas de Broomn, o druida contador de histórias. Um lugar para histórias que merecem ser compartilhadas ao redor da fogueira.',
    openGraph: {
      title: "Blog do Broomn",
      description: 'Crônicas de Broomn, o druida contador de histórias. Um lugar para histórias que merecem ser compartilhadas ao redor da fogueira.',
      type: 'website',
    },
    alternates: buildAlternates(locale),
  };
}

export default async function HomePage() {
  const locale = await getLocale();

  return (
    <>
      <HeroSection />
      <Divider />
      <PostList dateLocale={locale === 'pt' ? 'pt-BR' : 'en-US'} />
    </>
  );
}
