import { translateHtml, translatePlainText } from './translate';
import { splitAroundEmbeds, isEmbedSegment } from './htmlEmbeds';

export interface LocalizedHtml {
  content: string;
  translated: boolean;
  error?: string;
}

// Posts/About/Support are authored in Portuguese. Translating server-side
// (rather than the old client-only useEffect) means crawlers and users alike
// get real English HTML in the first response — the old approach left
// Googlebot seeing untranslated Portuguese on every /en/ page, which GSC
// flagged as duplicate content of the /pt/ version.
export async function localizeHtml(html: string, locale: string): Promise<LocalizedHtml> {
  if (locale !== 'en') return { content: html, translated: false };

  // HTML embeds (see lib/htmlEmbeds.ts) must never reach MyMemory — translate
  // each surrounding text segment independently and leave embed segments
  // exactly as they are, rather than translating the whole string at once.
  const segments = splitAroundEmbeds(html);

  try {
    const translatedSegments: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      translatedSegments.push(
        isEmbedSegment(i) || segment.length === 0 ? segment : await translateHtml(segment, 'pt|en')
      );
    }
    return { content: translatedSegments.join(''), translated: true };
  } catch (err) {
    return { content: html, translated: false, error: err instanceof Error ? err.message : 'Translation failed' };
  }
}

export async function localizePlainText(text: string, locale: string): Promise<string> {
  if (locale !== 'en' || !text) return text;

  try {
    return await translatePlainText(text, 'pt|en');
  } catch {
    return text;
  }
}
