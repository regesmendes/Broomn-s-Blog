import { describe, it, expect, vi, beforeEach } from 'vitest';
import { localizeHtml } from './localizeContent';
import { translateHtml } from './translate';

vi.mock('./translate', () => ({
  translateHtml: vi.fn(),
  translatePlainText: vi.fn(),
}));

describe('localizeHtml', () => {
  beforeEach(() => {
    vi.mocked(translateHtml).mockReset();
  });

  it('delegates the whole document to translateHtml (embed-safety lives there now)', async () => {
    const html = '<p>Depois da nossa conversa.</p>';
    vi.mocked(translateHtml).mockResolvedValue({
      html: '<p>Depois da nossa conversation.</p>',
      partial: false,
    });

    const result = await localizeHtml(html, 'en');

    expect(translateHtml).toHaveBeenCalledWith(html, 'pt|en');
    expect(result.content).toBe('<p>Depois da nossa conversation.</p>');
    expect(result.translated).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('does not translate at all for the pt locale', async () => {
    const html = '<p>Texto.</p>';

    const result = await localizeHtml(html, 'pt');

    expect(translateHtml).not.toHaveBeenCalled();
    expect(result.content).toBe(html);
    expect(result.translated).toBe(false);
  });

  it('falls back to the original content if translation fails outright', async () => {
    const html = '<p>Texto.</p>';
    vi.mocked(translateHtml).mockRejectedValue(new Error('Translation service returned 429'));

    const result = await localizeHtml(html, 'en');

    expect(result.content).toBe(html);
    expect(result.translated).toBe(false);
    expect(result.error).toContain('429');
  });

  it('reports translated content with a note when translateHtml only partially succeeded', async () => {
    const html = '<p>Texto.</p><p>Mais texto.</p>';
    vi.mocked(translateHtml).mockResolvedValue({
      html: '<p>Text.</p><p>Mais texto.</p>',
      partial: true,
    });

    const result = await localizeHtml(html, 'en');

    expect(result.content).toBe('<p>Text.</p><p>Mais texto.</p>');
    expect(result.translated).toBe(true);
    expect(result.error).toBe('Part of this content could not be translated');
  });
});
