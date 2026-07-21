import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { CommentSection } from './CommentSection';
import api from '@/lib/api';
import type { Comment } from '@/lib/api';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, getToken: () => null }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getComments: vi.fn(),
    },
  };
});

const mockGetComments = vi.mocked(api.getComments);

function topLevelWithReply(): Comment {
  return {
    id: 'c1',
    content: 'Great post!',
    approved: true,
    isOwnerReply: false,
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    user: { id: 'u1', name: 'Alice', avatarUrl: null },
    replies: [
      {
        id: 'r1',
        content: 'Thanks for reading!',
        approved: true,
        isOwnerReply: true,
        parentId: 'c1',
        createdAt: '2026-01-02T00:00:00.000Z',
        user: { id: null, name: 'Broomn', avatarUrl: '/images/logo.png' },
        replies: [],
      },
    ],
  };
}

describe('CommentSection', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a nested owner reply with the author badge, under its parent comment', async () => {
    mockGetComments.mockResolvedValue({
      data: [topLevelWithReply()],
      meta: { nextCursor: null, hasMore: false },
    });

    await act(async () => {
      render(<CommentSection postId="post-1" />);
      await Promise.resolve();
    });

    expect(screen.getByText('Great post!')).toBeInTheDocument();
    expect(screen.getByText('Thanks for reading!')).toBeInTheDocument();
    expect(screen.getByText('Broomn')).toBeInTheDocument();
    expect(screen.getByText('authorReplyBadge')).toBeInTheDocument();
  });

  it('does not show the author badge on a regular (non-owner) comment', async () => {
    mockGetComments.mockResolvedValue({
      data: [{ ...topLevelWithReply(), replies: [] }],
      meta: { nextCursor: null, hasMore: false },
    });

    await act(async () => {
      render(<CommentSection postId="post-1" />);
      await Promise.resolve();
    });

    expect(screen.queryByText('authorReplyBadge')).not.toBeInTheDocument();
  });
});
