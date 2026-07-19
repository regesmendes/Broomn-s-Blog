import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except API routes, static files, and the
  // unprefixed robots.txt/sitemap.xml routes (app/robots.ts, app/sitemap.ts).
  matcher: ['/((?!api|_next|images|favicon|robots\\.txt|sitemap\\.xml).*)'],
};
