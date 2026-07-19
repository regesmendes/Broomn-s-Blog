import type { MetadataRoute } from 'next';

const SITE_URL = 'https://blogdobroomn.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/pt/admin', '/en/admin'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
