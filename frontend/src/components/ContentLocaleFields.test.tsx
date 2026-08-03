import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { createRef } from 'react';
import { ContentLocaleFields, ContentLocaleFieldsHandle } from './ContentLocaleFields';
import { translateHtml } from '@/lib/translate';

vi.mock('@/lib/translate', () => ({
  translateHtml: vi.fn(),
}));

const insertImageMocks: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: forwardRef(function RichTextEditorStub(
    props: { content: string; onChange: (html: string) => void; placeholder?: string },
    ref
  ) {
    const key = props.placeholder?.includes('English') ? 'en' : 'pt';
    insertImageMocks[key] = vi.fn();
    useImperativeHandle(ref, () => ({ insertImage: insertImageMocks[key] }));
    return (
      <textarea
        data-testid={`content-editor-${key}`}
        value={props.content}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  }),
}));

function renderFields(overrides: Partial<{ pt: string; en: string }> = {}) {
  const onChangePt = vi.fn();
  const onChangeEn = vi.fn();
  const onRequestImagePick = vi.fn();
  const ref = createRef<ContentLocaleFieldsHandle>();

  render(
    <ContentLocaleFields
      ref={ref}
      pt={overrides.pt ?? ''}
      en={overrides.en ?? ''}
      onChangePt={onChangePt}
      onChangeEn={onChangeEn}
      onRequestImagePick={onRequestImagePick}
    />
  );

  return { onChangePt, onChangeEn, onRequestImagePick, ref };
}

describe('ContentLocaleFields', () => {
  beforeEach(() => {
    vi.mocked(translateHtml).mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the PT tab by default and switches to EN on click', () => {
    renderFields();

    expect(screen.getByTestId('content-editor-pt')).toBeVisible();

    fireEvent.click(screen.getByText('English'));

    expect(screen.getByText('Translate to Portuguese')).toBeInTheDocument();
  });

  it('translates PT to EN and applies the result via onChangeEn', async () => {
    vi.mocked(translateHtml).mockResolvedValue({ html: '<p>Hi (EN)</p>', partial: false });

    const { onChangeEn } = renderFields({ pt: '<p>Oi</p>' });

    fireEvent.click(screen.getByText('Translate to English'));

    await waitFor(() => expect(onChangeEn).toHaveBeenCalledWith('<p>Hi (EN)</p>'));

    expect(translateHtml).toHaveBeenCalledWith('<p>Oi</p>', 'pt|en');
  });

  it('asks for confirmation before overwriting non-blank target content, and aborts if declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { onChangeEn } = renderFields({ pt: '<p>Oi</p>', en: '<p>Existing</p>' });

    fireEvent.click(screen.getByText('Translate to English'));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());

    expect(translateHtml).not.toHaveBeenCalled();
    expect(onChangeEn).not.toHaveBeenCalled();
  });

  it('does not ask for confirmation when the target tab is blank', async () => {
    vi.mocked(translateHtml).mockResolvedValue({ html: '<p>Hi (EN)</p>', partial: false });

    renderFields({ pt: '<p>Oi</p>', en: '' });

    fireEvent.click(screen.getByText('Translate to English'));
    await waitFor(() => expect(translateHtml).toHaveBeenCalled());

    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('surfaces a partial-translation warning without discarding the result', async () => {
    vi.mocked(translateHtml).mockResolvedValue({ html: '<p>partly done</p>', partial: true });

    renderFields({ pt: '<p>Oi</p>' });

    fireEvent.click(screen.getByText('Translate to English'));
    await screen.findByText(/could not be translated/i);
  });

  it('routes insertImage to the correct tab\'s editor', () => {
    const { ref } = renderFields();

    ref.current?.insertImage('pt', 'https://example.com/a.png');
    expect(insertImageMocks.pt).toHaveBeenCalledWith('https://example.com/a.png');

    ref.current?.insertImage('en', 'https://example.com/b.png');
    expect(insertImageMocks.en).toHaveBeenCalledWith('https://example.com/b.png');
  });
});
