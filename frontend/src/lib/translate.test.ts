import { describe, it, expect } from 'vitest';
import { splitHtmlContent } from './translate';

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
