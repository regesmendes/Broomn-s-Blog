import { describe, it, expect, vi, beforeEach } from 'vitest';
import { localizeHtml } from './localizeContent';
import { translateHtml } from './translate';

vi.mock('./translate', () => ({
  translateHtml: vi.fn(),
  translatePlainText: vi.fn(),
}));

function embedDiv(rawHtml: string): string {
  return `<div data-html-embed="${Buffer.from(rawHtml, 'utf-8').toString('base64')}"></div>`;
}

describe('localizeHtml', () => {
  beforeEach(() => {
    vi.mocked(translateHtml).mockReset();
  });

  it('never sends an embed to the translation API, and reassembles it unchanged afterward', async () => {
    const embed = embedDiv('<script data-id="reges"></script>');
    const html = `<p>Depois da nossa conversa.</p>${embed}`;

    vi.mocked(translateHtml).mockImplementation(async (input) => input.replace('conversa', 'conversation'));

    const result = await localizeHtml(html, 'en');

    // translateHtml must only ever be called with the surrounding text segment.
    expect(translateHtml).toHaveBeenCalledTimes(1);
    const [translatedArg] = vi.mocked(translateHtml).mock.calls[0];
    expect(translatedArg).not.toContain('data-html-embed');

    expect(result.content).toBe('<p>Depois da nossa conversation.</p>' + embed);
    expect(result.translated).toBe(true);
  });

  it('handles an embed sandwiched between two text segments, translating both independently', async () => {
    const embed = embedDiv('<script></script>');
    const html = `<p>Antes.</p>${embed}<p>Depois.</p>`;

    vi.mocked(translateHtml).mockImplementation(async (input) =>
      input.replace('Antes', 'Before').replace('Depois', 'After')
    );

    const result = await localizeHtml(html, 'en');

    expect(translateHtml).toHaveBeenCalledTimes(2);
    expect(result.content).toBe(`<p>Before.</p>${embed}<p>After.</p>`);
  });

  it('does not translate at all for the pt locale, embed included', async () => {
    const embed = embedDiv('<script></script>');
    const html = `<p>Texto.</p>${embed}`;

    const result = await localizeHtml(html, 'pt');

    expect(translateHtml).not.toHaveBeenCalled();
    expect(result.content).toBe(html);
    expect(result.translated).toBe(false);
  });

  it('falls back to the original content (embed intact) if translation fails', async () => {
    const embed = embedDiv('<script></script>');
    const html = `<p>Texto.</p>${embed}`;
    vi.mocked(translateHtml).mockRejectedValue(new Error('Translation service returned 429'));

    const result = await localizeHtml(html, 'en');

    expect(result.content).toBe(html);
    expect(result.translated).toBe(false);
    expect(result.error).toContain('429');
  });
});
