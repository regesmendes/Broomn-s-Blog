import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://blogdobroomn.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SitemapPost {
  slug: string;
  updatedAt: string;
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await fetchAllPublishedPosts();
  const staticPaths: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '', changeFrequency: 'daily' },
    { path: '/about', changeFrequency: 'monthly' },
    { path: '/newsletter', changeFrequency: 'monthly' },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const { path, changeFrequency } of staticPaths) {
      entries.push({ url: `${SITE_URL}/${locale}${path}`, changeFrequency });
    }
    for (const post of posts) {
      entries.push({
        url: `${SITE_URL}/${locale}/posts/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: 'weekly',
      });
    }
  }

  return entries;
}
