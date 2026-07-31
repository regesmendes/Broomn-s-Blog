import { translateHtml, translatePlainText } from './translate';

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

  try {
    const result = await translateHtml(html, 'pt|en');
    return {
      content: result.html,
      translated: true,
      error: result.partial ? 'Part of this content could not be translated' : undefined,
    };
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
