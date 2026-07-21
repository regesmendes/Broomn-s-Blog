import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import AdminCommentsPage from './page';
import api from '@/lib/api';
import type { AdminComment } from '@/lib/api';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ getToken: () => 'test-token' }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getAdminComments: vi.fn(),
      replyAsBroomn: vi.fn(),
    },
  };
});

const mockGetAdminComments = vi.mocked(api.getAdminComments);
const mockReplyAsBroomn = vi.mocked(api.replyAsBroomn);

function topLevelComment(): AdminComment {
  return {
    id: 'c1',
    content: 'Great post!',
    approved: true,
    isOwnerReply: false,
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    user: { id: 'u1', name: 'Alice', avatarUrl: null },
    post: { id: 'p1', title: 'A Post', slug: 'a-post' },
  };
}

async function renderAndLoad() {
  render(<AdminCommentsPage />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AdminCommentsPage — reply as Broomn', () => {
  beforeEach(() => {
    mockGetAdminComments.mockResolvedValue({
      data: [topLevelComment()],
      meta: { nextCursor: null, hasMore: false, total: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a reply nested under its parent, without its own reply action', async () => {
    mockGetAdminComments.mockResolvedValue({
      data: [
        {
          ...topLevelComment(),
          replies: [
            {
              id: 'r1',
              content: 'Thanks for reading!',
              approved: true,
              isOwnerReply: true,
              parentId: 'c1',
              createdAt: '2026-01-02T00:00:00.000Z',
              user: { id: 'admin-user-id', name: 'Reges', avatarUrl: null },
            },
          ],
        },
      ],
      meta: { nextCursor: null, hasMore: false, total: 1 },
    });

    await renderAndLoad();

    expect(screen.getByText('Great post!')).toBeInTheDocument();
    expect(screen.getByText('Thanks for reading!')).toBeInTheDocument();
    // Admin view shows the real name, not the masked "Broomn" persona.
    expect(screen.getByText('Reges')).toBeInTheDocument();
    // Only the top-level comment can be replied to.
    expect(screen.getAllByText('↩ Reply as Broomn')).toHaveLength(1);
  });

  it('submits a reply and reloads the comment list', async () => {
    mockReplyAsBroomn.mockResolvedValue({
      id: 'r1',
      content: 'Thanks!',
      approved: true,
      isOwnerReply: true,
      parentId: 'c1',
      createdAt: '2026-01-02T00:00:00.000Z',
      user: { id: null, name: 'Broomn', avatarUrl: '/favicon.png' },
    });

    await renderAndLoad();

    fireEvent.click(screen.getByText('↩ Reply as Broomn'));
    fireEvent.change(screen.getByPlaceholderText('Reply as Broomn...'), {
      target: { value: 'Thanks for reading!' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Post Reply'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReplyAsBroomn).toHaveBeenCalledWith('c1', 'Thanks for reading!', 'test-token');
    // The inline form closes and the list is reloaded after a successful reply.
    expect(mockGetAdminComments).toHaveBeenCalledTimes(2);
    expect(screen.queryByPlaceholderText('Reply as Broomn...')).not.toBeInTheDocument();
  });
});
