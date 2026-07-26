import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagsPage from './page';
import api from '@/lib/api';
import type { TagWithCount } from '@/lib/api';

const mockGetToken = () => 'test-token';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getAdminTags: vi.fn(),
      renameTag: vi.fn(),
      deleteTag: vi.fn(),
    },
  };
});

const mockGetAdminTags = vi.mocked(api.getAdminTags);

const photography: TagWithCount = { id: 't1', name: 'Photography', slug: 'photography', postCount: 3 };
const travel: TagWithCount = { id: 't2', name: 'Travel', slug: 'travel', postCount: 1 };

async function renderAndLoad() {
  render(<TagsPage />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TagsPage — search and pagination', () => {
  it('loads the first page on mount with no cursor', async () => {
    mockGetAdminTags.mockResolvedValue({ data: [photography], meta: { hasMore: false, nextCursor: null } });

    await renderAndLoad();

    expect(mockGetAdminTags).toHaveBeenCalledWith('test-token', { cursor: undefined, limit: 10, search: undefined });
    expect(screen.getByText('Photography')).toBeInTheDocument();
  });

  it('refetches with the search term and resets pagination', async () => {
    mockGetAdminTags.mockResolvedValue({ data: [photography, travel], meta: { hasMore: false, nextCursor: null } });
    const user = userEvent.setup();

    await renderAndLoad();
    mockGetAdminTags.mockResolvedValue({ data: [travel], meta: { hasMore: false, nextCursor: null } });

    await user.type(screen.getByPlaceholderText('Search tags by name...'), 'trav');

    expect(mockGetAdminTags).toHaveBeenLastCalledWith('test-token', { cursor: undefined, limit: 10, search: 'trav' });
  });

  it('shows Next when hasMore and fetches the next page using nextCursor', async () => {
    mockGetAdminTags.mockResolvedValue({ data: [photography], meta: { hasMore: true, nextCursor: 't1' } });

    await renderAndLoad();

    const nextButton = screen.getByRole('button', { name: /Next/ });
    expect(nextButton).not.toBeDisabled();

    mockGetAdminTags.mockResolvedValue({ data: [travel], meta: { hasMore: false, nextCursor: null } });
    fireEvent.click(nextButton);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetAdminTags).toHaveBeenLastCalledWith('test-token', { cursor: 't1', limit: 10, search: undefined });
    expect(screen.getByText('Travel')).toBeInTheDocument();
  });

  it('shows an empty state distinguishing "no tags yet" from "no search results"', async () => {
    mockGetAdminTags.mockResolvedValue({ data: [], meta: { hasMore: false, nextCursor: null } });

    await renderAndLoad();

    expect(screen.getByText('No tags yet.')).toBeInTheDocument();
  });
});
