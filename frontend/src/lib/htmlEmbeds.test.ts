import { describe, it, expect } from 'vitest';
import { splitAroundEmbeds, isEmbedSegment, resolveHtmlEmbeds } from './htmlEmbeds';

function embedDiv(rawHtml: string): string {
  return `<div data-html-embed="${Buffer.from(rawHtml, 'utf-8').toString('base64')}"></div>`;
}

describe('splitAroundEmbeds / isEmbedSegment', () => {
  it('splits text and embed markup into alternating segments', () => {
    const embed = embedDiv('<script data-id="reges"></script>');
    const html = `<p>Obrigado por ler.</p>${embed}<p>Mais texto.</p>`;

    const segments = splitAroundEmbeds(html);

    expect(segments).toEqual(['<p>Obrigado por ler.</p>', embed, '<p>Mais texto.</p>']);
    expect(isEmbedSegment(0)).toBe(false);
    expect(isEmbedSegment(1)).toBe(true);
    expect(isEmbedSegment(2)).toBe(false);
  });

  it('handles multiple embeds in the same content, in order', () => {
    const embedA = embedDiv('<script>one</script>');
    const embedB = embedDiv('<script>two</script>');
    const html = `${embedA}<p>middle</p>${embedB}`;

    const segments = splitAroundEmbeds(html);
    expect(segments).toEqual(['', embedA, '<p>middle</p>', embedB, '']);
  });

  it('is a single, non-embed segment when there are no embeds', () => {
    const html = '<p>No embeds here.</p>';
    expect(splitAroundEmbeds(html)).toEqual([html]);
  });
});

describe('resolveHtmlEmbeds', () => {
  it('decodes the embed back into real, executable markup', () => {
    const raw = '<script src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js" data-id="reges"></script>';
    const html = `<p>Thanks for reading.</p>${embedDiv(raw)}`;

    expect(resolveHtmlEmbeds(html)).toBe(`<p>Thanks for reading.</p>${raw}`);
  });

  it('resolves multiple embeds independently', () => {
    const html = `${embedDiv('<script>a</script>')}<p>x</p>${embedDiv('<script>b</script>')}`;
    expect(resolveHtmlEmbeds(html)).toBe('<script>a</script><p>x</p><script>b</script>');
  });

  it('leaves content with no embeds untouched', () => {
    const html = '<p>Plain content.</p>';
    expect(resolveHtmlEmbeds(html)).toBe(html);
  });
});
