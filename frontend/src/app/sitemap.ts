import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SitemapPost {
  slug: string;
  updatedAt: string;
  titleEn?: string;
}

// Walks the same cursor-paginated /posts endpoint the homepage uses — there's
// no bulk export endpoint, so a sitemap needs every page.
async function fetchAllPublishedPosts(): Promise<SitemapPost[]> {
  const posts: SitemapPost[] = [];
  let cursor: string | undefined;

  try {
    do {
      const params = new URLSearchParams({ limit: '100' });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`${API_URL}/posts?${params}`, { cache: 'no-store' });
      if (!res.ok) break;
      const { data, meta } = await res.json();
      posts.push(...data);
      cursor = meta.hasMore ? meta.nextCursor : undefined;
    } while (cursor);
  } catch {
    // If the API is briefly unreachable, still serve a sitemap with the
    // static pages rather than a 500.
  }

  return posts;
}

// Singleton pages (About/Support) — just need to know whether an English
// translation exists. Defaults to true (don't exclude) on any fetch failure,
// same "degrade gracefully" stance as fetchAllPublishedPosts.
async function hasEnglishTranslation(path: 'about' | 'support'): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/${path}`, { cache: 'no-store' });
    if (!res.ok) return true;
    const data = await res.json();
    return !!data.contentEn;
  } catch {
    return true;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, hasEnAbout, hasEnSupport] = await Promise.all([
    fetchAllPublishedPosts(),
    hasEnglishTranslation('about'),
    hasEnglishTranslation('support'),
  ]);

  const staticPaths: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '', changeFrequency: 'daily' },
    { path: '/about', changeFrequency: 'monthly' },
    { path: '/support', changeFrequency: 'monthly' },
    { path: '/newsletter', changeFrequency: 'monthly' },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const { path, changeFrequency } of staticPaths) {
      // No English translation yet — that page canonicals at /pt/ and is
      // noindexed (see about/page.tsx and support/page.tsx), so it doesn't
      // belong here.
      if (locale === 'en' && path === '/about' && !hasEnAbout) continue;
      if (locale === 'en' && path === '/support' && !hasEnSupport) continue;

      entries.push({ url: `${SITE_URL}/${locale}${path}`, changeFrequency });
    }
    for (const post of posts) {
      // Same reasoning, per-post.
      if (locale === 'en' && !post.titleEn) continue;

      entries.push({
        url: `${SITE_URL}/${locale}/posts/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: 'weekly',
      });
    }
  }

  return entries;
}
