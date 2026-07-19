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
});
