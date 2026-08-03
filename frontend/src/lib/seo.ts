import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/constants';

export interface BuildAlternatesOptions {
  // Set to false when the /en/ variant has no real translation yet — drops
  // the "en" entry from `languages` so hreflang doesn't advertise a page
  // that would just serve untranslated Portuguese under an English tag.
  includeEn?: boolean;
  // Locale the canonical URL should point at. Defaults to `locale` itself;
  // an /en/ page falling back to Portuguese content should canonical at its
  // /pt/ URL instead of claiming to be the authoritative English version.
  canonicalLocale?: string;
}

// Every indexable page must call this so Google gets an explicit canonical
// and hreflang set instead of guessing among locale-prefixed duplicates
// (this is what fixed the "duplicate without user-selected canonical" GSC report).
export function buildAlternates(locale: string, path: string = '', options?: BuildAlternatesOptions) {
  const includeEn = options?.includeEn ?? true;
  const canonicalLocale = options?.canonicalLocale ?? locale;

  const languages: Record<string, string> = {
    ...Object.fromEntries(
      routing.locales
        .filter((l) => includeEn || l !== 'en')
        .map((l) => [l, `${SITE_URL}/${l}${path}`])
    ),
    'x-default': `${SITE_URL}/${routing.defaultLocale}${path}`,
  };

  return {
    canonical: `${SITE_URL}/${canonicalLocale}${path}`,
    languages,
  };
}
