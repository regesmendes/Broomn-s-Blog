import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import EditPostPage from './page';
import api from '@/lib/api';
import type { Post } from '@/lib/api';

const AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000;

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'post-1' }),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ getToken: () => 'test-token', isLoading: false }),
}));

vi.mock('@/components/ImagePickerModal', () => ({
  ImagePickerModal: () => null,
}));

// The editor itself (Tiptap) is already covered by its own tests — here we
// only need something that reports content changes, so the page's autosave
// orchestration can be exercised without mounting real ProseMirror.
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
      getPostById: vi.fn(),
      updatePost: vi.fn(),
    },
  };
});

const mockGetPostById = vi.mocked(api.getPostById);
const mockUpdatePost = vi.mocked(api.updatePost);

const samplePost: Post = {
  id: 'post-1',
  title: 'Original title',
  slug: 'original-title',
  excerpt: '',
  content: '<p>Hello</p>',
  coverImage: '',
  tags: [],
  status: 'DRAFT',
  publishedAt: undefined,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  authorId: 'user-1',
};

async function renderAndLoad() {
  render(<EditPostPage />);
  // Flush the loadPost() microtask chain (mocked getPostById resolves
  // immediately, no real delay involved).
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('EditPostPage — save feedback and autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetPostById.mockResolvedValue(samplePost);
    mockUpdatePost.mockResolvedValue(samplePost);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows "Saved." after a manual save, then fades and disappears on its own', async () => {
    await renderAndLoad();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Saved.')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3700);
    });

    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('autosaves a dirty form after 3 minutes and shows a fading "Auto-saved" indicator', async () => {
    await renderAndLoad();

    fireEvent.change(screen.getByTestId('content-editor'), {
      target: { value: '<p>Edited content</p>' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS);
    });

    expect(mockUpdatePost).toHaveBeenCalledTimes(1);
    expect(mockUpdatePost).toHaveBeenCalledWith(
      'post-1',
      expect.objectContaining({ content: '<p>Edited content</p>' }),
      'test-token'
    );
    expect(screen.getByText(/auto-saved at/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3700);
    });

    expect(screen.queryByText(/auto-saved at/i)).not.toBeInTheDocument();
  });

  it('skips the autosave tick when nothing changed since the last save', async () => {
    await renderAndLoad();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS);
    });

    expect(mockUpdatePost).not.toHaveBeenCalled();
    expect(screen.queryByText(/auto-saved at/i)).not.toBeInTheDocument();
  });

  it('shows a persistent (non-fading) message when an autosave tick fails', async () => {
    mockUpdatePost.mockRejectedValueOnce(new Error('network down'));
    await renderAndLoad();

    fireEvent.change(screen.getByTestId('content-editor'), {
      target: { value: '<p>Edited content</p>' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS);
    });

    expect(screen.getByText(/auto-save failed/i)).toBeInTheDocument();

    // Unlike the success indicators, this should still be there well past
    // the ~3.7s fade window used for "Saved." / "Auto-saved at...".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByText(/auto-save failed/i)).toBeInTheDocument();
  });

  it('a manual save resets the autosave timer instead of stacking a second one', async () => {
    await renderAndLoad();

    // Get most of the way to the first scheduled autosave...
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 5000);
    });

    // ...then save manually, which should push the next tick out a fresh
    // 3 minutes rather than letting the original timer fire in 5s.
    fireEvent.change(screen.getByTestId('content-editor'), {
      target: { value: '<p>Edited content</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUpdatePost).toHaveBeenCalledTimes(1);

    // If the old timer weren't cleared, it would have fired by now (5s + a
    // bit) and triggered a second, redundant autosave call.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockUpdatePost).toHaveBeenCalledTimes(1);
  });
});
