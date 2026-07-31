import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { splitHtmlContent, translateHtml } from './translate';

function mockMyMemoryResponse(translatedText: string, responseStatus: number | string = 200) {
  return {
    ok: true,
    json: async () => ({ responseStatus, responseData: { translatedText } }),
  };
}

describe('splitHtmlContent', () => {
  it('keeps short blocks together in a single chunk', () => {
    const html = '<p>Short paragraph one.</p><p>Short paragraph two.</p>';
    const chunks = splitHtmlContent(html, 450);
    expect(chunks).toEqual([html]);
  });

  it('splits a single oversized block that previously slipped through untouched', () => {
    // Regression test: a single <p> longer than maxLength used to be sent as
    // one oversized chunk and rejected outright by MyMemory's 500-char limit.
    const longSentence = 'Esta e uma frase razoavelmente longa sobre o blog. ';
    const longParagraph = `<p>${longSentence.repeat(15)}</p>`; // ~1000 chars
    expect(longParagraph.length).toBeGreaterThan(450);

    const chunks = splitHtmlContent(longParagraph, 450);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(450);
    }
    // No content lost or reordered across the split.
    expect(chunks.join('')).toBe(longParagraph);
  });

  it('splits a plain oversized block at real sentence boundaries, not mid-word', () => {
    // Regression test for a bug where the block's own <p> wrapper was counted
    // like an inline mark, so depth never returned to 0 inside the text and
    // no sentence boundary was ever found — silently falling back to a raw
    // length-based cut (e.g. mid-word) for every oversized plain paragraph.
    const longSentence = 'Esta e uma frase razoavelmente longa sobre o blog. ';
    const longParagraph = `<p>${longSentence.repeat(15)}</p>`;
    expect(longParagraph.length).toBeGreaterThan(450);

    const chunks = splitHtmlContent(longParagraph, 450);

    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk but the last should end right after a sentence boundary
    // (". "), not mid-word — proving the depth-0 detection actually engaged.
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk).toMatch(/[.!?]\s$/);
    }
    expect(chunks.join('')).toBe(longParagraph);
  });

  it('never splits inside an inline tag that spans a sentence boundary', () => {
    const filler = 'palavra '.repeat(40); // padding to force an oversized block
    const html = `<p>${filler}<strong>Primeira frase aqui. Segunda frase aqui.</strong>${filler}</p>`;
    expect(html.length).toBeGreaterThan(450);

    const chunks = splitHtmlContent(html, 450);

    for (const chunk of chunks) {
      const opens = (chunk.match(/<strong>/g) || []).length;
      const closes = (chunk.match(/<\/strong>/g) || []).length;
      expect(opens).toBe(closes);
    }
    expect(chunks.join('')).toBe(html);
  });

  it('falls back to a raw split when a block has no safe boundary at all', () => {
    // One giant unbroken run inside a single tag, no sentence punctuation.
    const html = `<p><a href="https://example.com">${'a'.repeat(600)}</a></p>`;
    const chunks = splitHtmlContent(html, 450);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(450);
    }
    expect(chunks.join('')).toBe(html);
  });

  it('keeps a figure+caption intact as one chunk boundary, even when surrounding text is oversized', () => {
    const filler = 'Texto de enchimento para forcar quebra. '.repeat(6);
    const figure = '<figure><img src="/img.jpg" alt=""><figcaption>Uma legenda curta sobre a imagem.</figcaption></figure>';
    const html = `<p>${filler}</p>${figure}<p>${filler}</p>`;
    expect(html.length).toBeGreaterThan(450);

    const chunks = splitHtmlContent(html, 450);

    // The figure must appear whole inside exactly one chunk — never split.
    const chunksContainingFigure = chunks.filter((c) => c.includes(figure));
    expect(chunksContainingFigure).toHaveLength(1);
    expect(chunks.join('')).toBe(html);
  });

  it('splits an oversized caption at sentence boundaries, never mid-word', () => {
    const longCaptionSentence = 'Esta e uma legenda razoavelmente longa sobre a imagem do blog. ';
    const figure = `<figure><img src="/img.jpg" alt=""><figcaption>${longCaptionSentence.repeat(10)}</figcaption></figure>`;
    expect(figure.length).toBeGreaterThan(450);

    const chunks = splitHtmlContent(figure, 450);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk).toMatch(/[.!?]\s$/);
    }
    expect(chunks.join('')).toBe(figure);
  });

  it('never splits inside an inline mark nested in a caption', () => {
    const filler = 'palavra '.repeat(30);
    const figure = `<figure><img src="/img.jpg" alt=""><figcaption>${filler}<strong>Primeira frase aqui. Segunda frase aqui.</strong>${filler}</figcaption></figure>`;
    expect(figure.length).toBeGreaterThan(450);

    const chunks = splitHtmlContent(figure, 450);

    for (const chunk of chunks) {
      const opens = (chunk.match(/<strong>/g) || []).length;
      const closes = (chunk.match(/<\/strong>/g) || []).length;
      expect(opens).toBe(closes);
    }
    expect(chunks.join('')).toBe(figure);
  });
});

describe('translateHtml', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('never sends an embed to the translation API, and reassembles it unchanged afterward', async () => {
    const embedHtml = Buffer.from('<script data-id="reges"></script>', 'utf-8').toString('base64');
    const embed = `<div data-html-embed="${embedHtml}"></div>`;
    const html = `<p>Depois da nossa conversa.</p>${embed}`;

    vi.mocked(global.fetch).mockResolvedValue(mockMyMemoryResponse('<p>Depois da nossa conversation.</p>') as Response);

    const result = await translateHtml(html, 'pt|en');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).not.toContain('data-html-embed');
    expect(result.html).toBe(`<p>Depois da nossa conversation.</p>${embed}`);
    expect(result.partial).toBe(false);
  });

  it('handles an embed sandwiched between two text segments, translating both independently', async () => {
    const embedHtml = Buffer.from('<script></script>', 'utf-8').toString('base64');
    const embed = `<div data-html-embed="${embedHtml}"></div>`;
    const html = `<p>Antes.</p>${embed}<p>Depois.</p>`;

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockMyMemoryResponse('<p>Before.</p>') as Response)
      .mockResolvedValueOnce(mockMyMemoryResponse('<p>After.</p>') as Response);

    const result = await translateHtml(html, 'pt|en');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.html).toBe(`<p>Before.</p>${embed}<p>After.</p>`);
  });

  it('keeps a failed chunk in its original language instead of discarding the whole result', async () => {
    // The first paragraph alone must stay under 450 chars (so it isn't split
    // further on its own) but be long enough that adding the second paragraph
    // pushes the running chunk over 450 — that's what forces a chunk break
    // between them, landing each paragraph in its own translateChunk call.
    const firstParagraph = `<p>${'a'.repeat(420)}</p>`;
    const secondParagraph = `<p>Segundo paragrafo intacto.</p>`;
    const html = firstParagraph + secondParagraph;

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockMyMemoryResponse('<p>Translated first paragraph.</p>') as Response)
      .mockRejectedValueOnce(new Error('network error'));

    const result = await translateHtml(html, 'pt|en');

    expect(result.partial).toBe(true);
    expect(result.html).toBe('<p>Translated first paragraph.</p>' + secondParagraph);
  });

  it('treats a string "200" responseStatus as success', async () => {
    const html = '<p>Ola.</p>';
    vi.mocked(global.fetch).mockResolvedValue(mockMyMemoryResponse('<p>Hi.</p>', '200') as Response);

    const result = await translateHtml(html, 'pt|en');

    expect(result.html).toBe('<p>Hi.</p>');
    expect(result.partial).toBe(false);
  });

  it('sends an AbortSignal with each request so a hung request eventually times out', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockMyMemoryResponse('Hi.') as Response);

    await translateHtml('<p>Ola.</p>', 'pt|en');

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    expect((options as RequestInit)?.signal).toBeInstanceOf(AbortSignal);
  });
});
