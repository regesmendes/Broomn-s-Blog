import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/constants';

// Every indexable page must call this so Google gets an explicit canonical
// and hreflang set instead of guessing among locale-prefixed duplicates
// (this is what fixed the "duplicate without user-selected canonical" GSC report).
export function buildAlternates(locale: string, path: string = '') {
  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`])),
      'x-default': `${SITE_URL}/${routing.defaultLocale}${path}`,
    },
  };
}
