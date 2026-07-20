const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

// Registering a contact email raises MyMemory's daily anonymous quota from
// 5,000 to 50,000 words/day. Worth it here: chunking a long post means more
// requests for the same amount of content than before this fix.
const CONTACT_EMAIL = 'noreply@blogdobroomn.com';

// Comfortably under MyMemory's real ~500-char per-request limit, leaving
// margin for URL-encoding overhead (accented PT characters, spaces, etc. all
// expand when percent-encoded into the query string).
const MAX_CHUNK_LENGTH = 450;

async function translateChunk(text: string, langpair: string): Promise<string> {
  const params = new URLSearchParams({ q: text, langpair, de: CONTACT_EMAIL });
  const response = await fetch(`${MYMEMORY_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`Translation service returned ${response.status}`);
  }

  const data = await response.json();
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'Translation failed');
  }

  return data.responseData.translatedText;
}

/**
 * Splits HTML into chunks that (a) never exceed maxLength and (b) stay valid
 * HTML wherever possible, so each chunk can be translated independently and
 * the results joined back together.
 *
 * Pass 1 splits between block-level elements (p, h1-6, li, blockquote, div,
 * pre, figure) — a boundary between blocks is never inside a tag, so this is
 * always safe. Pass 2 (splitOversizedBlock) catches any single block that's
 * still too long on its own (e.g. one long paragraph) — this used to slip
 * through untouched and get rejected outright by MyMemory.
 */
export function splitHtmlContent(html: string, maxLength: number = MAX_CHUNK_LENGTH): string[] {
  const blocks = html.split(/(?<=<\/(?:p|h[1-6]|li|blockquote|div|figure|pre)>)/i);
  const chunks: string[] = [];
  let current = '';

  for (const block of blocks) {
    if (block.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...splitOversizedBlock(block, maxLength));
      continue;
    }

    if ((current + block).length > maxLength && current) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [html];
}

// Splits a single oversized block at sentence boundaries, only at points
// where inline-tag depth is 0 — i.e. never inside an unclosed tag like
// <strong>...</strong> that happens to span a sentence break. Falls back to
// a raw length-based cut if no safe boundary appears before the limit (an
// extremely rare case — e.g. one inline tag alone longer than maxLength —
// which can in principle split a tag mid-attribute, but this doesn't occur
// in practice for Tiptap-authored prose).
function splitOversizedBlock(block: string, maxLength: number): string[] {
  const points = findSafeSplitPoints(block);
  const chunks: string[] = [];
  let start = 0;
  let candidate = 0;

  for (const point of points) {
    if (point - start <= maxLength) {
      candidate = point;
      continue;
    }
    const cut = candidate > start ? candidate : Math.min(start + maxLength, block.length);
    chunks.push(block.slice(start, cut));
    start = cut;
    candidate = start;
    if (point - start <= maxLength) {
      candidate = point;
    }
  }

  if (start < block.length) {
    chunks.push(block.slice(start));
  }

  return chunks;
}

// Scans the block once, tracking inline-tag nesting depth, and records an
// index right after every ". "/"! "/"? " that occurs at depth 0 (i.e.
// outside any open tag). Always includes the block's full length as a final
// candidate so the last chunk closes out correctly.
//
// The block's own outer wrapper tag (e.g. the <p>...</p> around everything)
// is stripped before scanning: it isn't an inline mark, so it must not count
// toward depth the same way <strong> does — otherwise depth starts at 1 and
// never returns to 0 anywhere inside the block's real text, and no sentence
// boundary is ever found. Split-point indices are offset back by the
// stripped prefix length so they still index into the original full string.
function findSafeSplitPoints(html: string): number[] {
  const outerMatch = html.match(/^<([a-z0-9]+)(?:\s[^>]*)?>/i);
  let prefixLength = 0;
  let inner = html;
  if (outerMatch) {
    const closeTag = `</${outerMatch[1]}>`;
    if (html.toLowerCase().endsWith(closeTag.toLowerCase())) {
      prefixLength = outerMatch[0].length;
      inner = html.slice(prefixLength, html.length - closeTag.length);
    }
  }

  const points: number[] = [];
  let depth = 0;
  let i = 0;

  while (i < inner.length) {
    if (inner[i] === '<') {
      const tagEnd = inner.indexOf('>', i);
      if (tagEnd === -1) break;
      const tag = inner.slice(i, tagEnd + 1);
      const isClosing = tag.startsWith('</');
      const isVoidElement = /\/>$/.test(tag) || /^<\/?(img|br|hr|input|meta|link|figcaption)\b/i.test(tag);
      if (!isVoidElement) {
        depth = isClosing ? Math.max(0, depth - 1) : depth + 1;
      }
      i = tagEnd + 1;
      continue;
    }

    if (depth === 0 && /[.!?]/.test(inner[i]) && /\s/.test(inner[i + 1] ?? '')) {
      points.push(prefixLength + i + 2);
    }
    i++;
  }

  points.push(html.length);
  return points;
}

export async function translateHtml(html: string, langpair: string): Promise<string> {
  const chunks = splitHtmlContent(html);
  const translated: string[] = [];

  for (const chunk of chunks) {
    translated.push(await translateChunk(chunk, langpair));
  }

  return translated.join('');
}

// Plain text (titles, excerpts) has no tags to worry about splitting inside
// of, so a simple whitespace-boundary split is enough.
export async function translatePlainText(text: string, langpair: string): Promise<string> {
  if (text.length <= MAX_CHUNK_LENGTH) {
    return translateChunk(text, langpair);
  }

  const words = text.split(/(\s+)/);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + word).length > MAX_CHUNK_LENGTH && current) {
      chunks.push(current);
      current = word;
    } else {
      current += word;
    }
  }
  if (current) chunks.push(current);

  const translated: string[] = [];
  for (const chunk of chunks.length > 0 ? chunks : [text]) {
    translated.push(await translateChunk(chunk, langpair));
  }
  return translated.join('');
}
