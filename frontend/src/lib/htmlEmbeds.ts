// Matches the exact shape rendered by components/tiptapHtmlEmbed.ts's
// HtmlEmbed node: an empty <div data-html-embed="...base64...">. The whole
// match is captured (not just the attribute) so splitAroundEmbeds can
// interleave the full embed markup into its result.
const EMBED_PATTERN = /(<div data-html-embed="[A-Za-z0-9+/=]*"><\/div>)/g;
const EMBED_PATTERN_GLOBAL = /<div data-html-embed="([A-Za-z0-9+/=]*)"><\/div>/g;

// Splits `html` into alternating segments: even indices are ordinary content
// (safe to translate independently), odd indices are the original, untouched
// embed div markup. Embeds must never be sent to MyMemory at all — not even
// as a placeholder token swapped back in afterward, since a first attempt at
// that (an HTML comment marker) was silently dropped by the translation API:
// comments aren't "text" worth preserving through a translate round-trip, so
// the embed simply vanished from the translated result. Never transmitting
// it in the first place is the only reliable option.
export function splitAroundEmbeds(html: string): string[] {
  return html.split(EMBED_PATTERN);
}

// True for the segments splitAroundEmbeds returns at odd indices — i.e. the
// embed markup itself, which the caller must pass through untranslated.
export function isEmbedSegment(index: number): boolean {
  return index % 2 === 1;
}

// Decodes an embed placeholder back into its real, executable markup — only
// called at final render time (PostContent.tsx), right before
// dangerouslySetInnerHTML, so the raw script only ever exists as live DOM
// content on the actually-rendered page, never mid-pipeline (DB row, API
// response, or translation input).
export function resolveHtmlEmbeds(html: string): string {
  return html.replace(EMBED_PATTERN_GLOBAL, (_match, encoded: string) => {
    try {
      return Buffer.from(encoded, 'base64').toString('utf-8');
    } catch {
      return '';
    }
  });
}
