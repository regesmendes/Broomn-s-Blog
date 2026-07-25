import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import UserSessionsPage from './page';
import api from '@/lib/api';

/** An already-fulfilled thenable: React's use() reads it synchronously, so
 * the page never suspends and the test needs no Suspense/act dance. */
function fulfilled<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
}

vi.mock('@/i18n/navigation', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ getToken: () => 'test-token' }),
}));

vi.mock('@/lib/api', () => ({
  default: { getAnalyticsUserSessions: vi.fn() },
}));

const mockApi = api as unknown as {
  getAnalyticsUserSessions: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(<UserSessionsPage params={fulfilled({ userId: 'user-1' })} />);
}

describe('UserSessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders the session list with journey links', async () => {
    mockApi.getAnalyticsUserSessions.mockResolvedValue({
      period: { from: '2026-06-25T00:00:00.000Z', to: '2026-07-25T23:59:59.999Z' },
      user: { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
      data: [
        {
          sessionId: 'session-a',
          pages: 7,
          firstSeen: '2026-07-01T10:00:00.000Z',
          lastSeen: '2026-07-01T10:30:00.000Z',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('Sessions — Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Journey →')).toHaveAttribute(
      'href',
      '/admin/analytics/users/user-1/sessions/session-a'
    );
    expect(mockApi.getAnalyticsUserSessions).toHaveBeenCalledWith(
      'user-1',
      'test-token',
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) })
    );
  });

  it('shows an empty state when the user has no sessions', async () => {
    mockApi.getAnalyticsUserSessions.mockResolvedValue({
      period: { from: '2026-06-25T00:00:00.000Z', to: '2026-07-25T23:59:59.999Z' },
      user: { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
      data: [],
    });

    renderPage();

    expect(await screen.findByText('No sessions in this period.')).toBeInTheDocument();
  });
});
