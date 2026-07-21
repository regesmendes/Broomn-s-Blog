import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import AdminNewsletterPage from './page';
import api from '@/lib/api';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ getToken: () => 'test-token' }),
}));

vi.mock('@/components/ImagePickerModal', () => ({
  ImagePickerModal: () => null,
}));

// The editor itself (Tiptap) is covered by its own tests — here we only
// need something that reports content changes, so the send flow can be
// exercised without mounting real ProseMirror.
vi.mock('@/components/RichTextEditor', () => ({
  RichTextEditor: forwardRef(function RichTextEditorStub(
    props: { content: string; onChange: (html: string) => void },
    ref
  ) {
    useImperativeHandle(ref, () => ({ insertImage: vi.fn() }));
    return (
      <textarea
        data-testid="content-editor"
        value={props.content}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getSubscribers: vi.fn(),
      sendNewsletter: vi.fn(),
    },
  };
});

const mockGetSubscribers = vi.mocked(api.getSubscribers);
const mockSendNewsletter = vi.mocked(api.sendNewsletter);

async function renderAndLoad() {
  render(<AdminNewsletterPage />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe('AdminNewsletterPage — rich-text composer', () => {
  beforeEach(() => {
    mockGetSubscribers.mockResolvedValue({
      data: [],
      meta: { nextCursor: null, hasMore: false },
      counts: { total: 0, confirmed: 0, pending: 0, unsubscribed: 0 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sends the rich-text HTML content as-is and clears the editor on success', async () => {
    mockSendNewsletter.mockResolvedValue({ sent: 3 });
    await renderAndLoad();

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'A subject' } });
    fireEvent.change(screen.getByTestId('content-editor'), {
      target: { value: '<p>Hello</p><p>World</p>' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send newsletter/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSendNewsletter).toHaveBeenCalledWith(
      { subject: 'A subject', content: '<p>Hello</p><p>World</p>' },
      'test-token'
    );
    expect(screen.getByText(/sent to 3 subscribers/i)).toBeInTheDocument();
    // The editor is controlled by `content`, which resets after a send.
    expect(screen.getByTestId('content-editor')).toHaveValue('');
  });
});
