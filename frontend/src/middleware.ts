import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

// next-intl's middleware issues its locale-prefix redirects (e.g. `/` -> `/pt`,
// `/about` -> `/pt/about`) as 307s with no way to configure the status code.
// Those redirects are permanent here — there's no locale-detection scenario
// where the unprefixed URL should ever resolve differently — so a 307 just
// tells Google not to consolidate indexing/ranking signals onto the target,
// leaving the old URL stuck in the index. Rewrite to a 308 to fix that.
export default function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  if (response.status === 307 && response.headers.has('location')) {
    return new NextResponse(null, { status: 308, headers: response.headers });
  }

  return response;
}

export const config = {
  // Match all pathnames except API routes, static files, and the
  // unprefixed robots.txt/sitemap.xml routes (app/robots.ts, app/sitemap.ts).
  matcher: ['/((?!api|_next|images|favicon|robots\\.txt|sitemap\\.xml).*)'],
};
