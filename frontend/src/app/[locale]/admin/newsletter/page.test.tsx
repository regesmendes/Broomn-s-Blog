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
      adminUnsubscribeSubscriber: vi.fn(),
      blockSubscriber: vi.fn(),
      unblockSubscriber: vi.fn(),
    },
  };
});

const mockGetSubscribers = vi.mocked(api.getSubscribers);
const mockSendNewsletter = vi.mocked(api.sendNewsletter);
const mockAdminUnsubscribe = vi.mocked(api.adminUnsubscribeSubscriber);
const mockBlockSubscriber = vi.mocked(api.blockSubscriber);
const mockUnblockSubscriber = vi.mocked(api.unblockSubscriber);

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

describe('AdminNewsletterPage — subscriber search + block/unblock/unsubscribe', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('searches subscribers by email', async () => {
    mockGetSubscribers.mockResolvedValue({
      data: [],
      meta: { nextCursor: null, hasMore: false },
      counts: { total: 0, confirmed: 0, pending: 0, unsubscribed: 0 },
    });
    await renderAndLoad();

    fireEvent.change(screen.getByPlaceholderText('Search by email...'), {
      target: { value: 'reader@example.com' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      await Promise.resolve();
    });

    expect(mockGetSubscribers).toHaveBeenLastCalledWith('test-token', {
      email: 'reader@example.com',
    });
  });

  it('shows a "Blocked" badge and offers Unblock for a blocked subscriber', async () => {
    mockGetSubscribers.mockResolvedValue({
      data: [
        {
          id: 'sub-1',
          email: 'spammer@example.com',
          status: 'UNSUBSCRIBED',
          confirmedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          blockedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      meta: { nextCursor: null, hasMore: false },
      counts: { total: 1, confirmed: 0, pending: 0, unsubscribed: 1 },
    });
    await renderAndLoad();

    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Unblock')).toBeInTheDocument();
    expect(screen.queryByText('Block')).not.toBeInTheDocument();
    // Already unsubscribed — no redundant unsubscribe action.
    expect(screen.queryByText('Unsubscribe')).not.toBeInTheDocument();
  });

  it('blocks a subscriber after confirming, then reloads the list', async () => {
    mockGetSubscribers.mockResolvedValue({
      data: [
        {
          id: 'sub-1',
          email: 'reader@example.com',
          status: 'CONFIRMED',
          confirmedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          blockedAt: null,
        },
      ],
      meta: { nextCursor: null, hasMore: false },
      counts: { total: 1, confirmed: 1, pending: 0, unsubscribed: 0 },
    });
    mockBlockSubscriber.mockResolvedValue({
      id: 'sub-1',
      email: 'reader@example.com',
      status: 'UNSUBSCRIBED',
      confirmedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      blockedAt: '2026-01-03T00:00:00.000Z',
    });
    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByText('Block'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockBlockSubscriber).toHaveBeenCalledWith('sub-1', 'test-token');
    expect(mockGetSubscribers).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes a confirmed subscriber after confirming', async () => {
    mockGetSubscribers.mockResolvedValue({
      data: [
        {
          id: 'sub-1',
          email: 'reader@example.com',
          status: 'CONFIRMED',
          confirmedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          blockedAt: null,
        },
      ],
      meta: { nextCursor: null, hasMore: false },
      counts: { total: 1, confirmed: 1, pending: 0, unsubscribed: 0 },
    });
    mockAdminUnsubscribe.mockResolvedValue({
      id: 'sub-1',
      email: 'reader@example.com',
      status: 'UNSUBSCRIBED',
      confirmedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      blockedAt: null,
    });
    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByText('Unsubscribe'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAdminUnsubscribe).toHaveBeenCalledWith('sub-1', 'test-token');
  });

  it('unblocks a subscriber without a confirmation prompt', async () => {
    mockGetSubscribers.mockResolvedValue({
      data: [
        {
          id: 'sub-1',
          email: 'reader@example.com',
          status: 'UNSUBSCRIBED',
          confirmedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          blockedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      meta: { nextCursor: null, hasMore: false },
      counts: { total: 1, confirmed: 0, pending: 0, unsubscribed: 1 },
    });
    mockUnblockSubscriber.mockResolvedValue({
      id: 'sub-1',
      email: 'reader@example.com',
      status: 'UNSUBSCRIBED',
      confirmedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      blockedAt: null,
    });
    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByText('Unblock'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUnblockSubscriber).toHaveBeenCalledWith('sub-1', 'test-token');
  });
});
