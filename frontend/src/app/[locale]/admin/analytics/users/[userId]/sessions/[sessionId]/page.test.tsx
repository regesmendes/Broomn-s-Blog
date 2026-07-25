import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SessionJourneyPage from './page';
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
  default: { getAnalyticsSessionJourney: vi.fn() },
}));

const mockApi = api as unknown as {
  getAnalyticsSessionJourney: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(
    <SessionJourneyPage params={fulfilled({ userId: 'user-1', sessionId: 'session-a' })} />
  );
}

describe('SessionJourneyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders the page-view timeline in order', async () => {
    mockApi.getAnalyticsSessionJourney.mockResolvedValue({
      sessionId: 'session-a',
      steps: [
        {
          type: 'pageview',
          id: 'pv-1',
          path: '/',
          durationMs: 4200,
          enteredAt: '2026-07-01T10:00:00.000Z',
          leftAt: '2026-07-01T10:00:04.200Z',
        },
        {
          type: 'pageview',
          id: 'pv-2',
          path: '/posts/hello',
          durationMs: 60_000,
          enteredAt: '2026-07-01T10:00:04.200Z',
          leftAt: '2026-07-01T10:01:04.200Z',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('/posts/hello')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText(/4\.2s on page/)).toBeInTheDocument();
    expect(screen.getByText(/1m 00s on page/)).toBeInTheDocument();
    expect(mockApi.getAnalyticsSessionJourney).toHaveBeenCalledWith(
      'user-1',
      'session-a',
      'test-token'
    );
  });

  it('interleaves a logged action between the page views around it', async () => {
    mockApi.getAnalyticsSessionJourney.mockResolvedValue({
      sessionId: 'session-a',
      steps: [
        {
          type: 'pageview',
          id: 'pv-1',
          path: '/posts/hello',
          durationMs: 300_000,
          enteredAt: '2026-07-01T10:00:00.000Z',
          leftAt: '2026-07-01T10:05:00.000Z',
        },
        {
          type: 'action',
          id: 'req-1',
          method: 'POST',
          path: '/posts/:postId/comments',
          statusCode: 201,
          durationMs: 42,
          createdAt: '2026-07-01T10:02:00.000Z',
        },
        {
          type: 'pageview',
          id: 'pv-2',
          path: '/posts/next',
          durationMs: 300_000,
          enteredAt: '2026-07-01T10:05:00.000Z',
          leftAt: '2026-07-01T10:10:00.000Z',
        },
      ],
    });

    renderPage();

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('/posts/hello');
    expect(items[1]).toHaveTextContent('POST /posts/:postId/comments');
    expect(items[1]).toHaveTextContent('201');
    expect(items[2]).toHaveTextContent('/posts/next');
  });

  it('surfaces a 404 as an error message', async () => {
    mockApi.getAnalyticsSessionJourney.mockRejectedValue(new Error('Session not found'));

    renderPage();

    expect(await screen.findByText('Session not found')).toBeInTheDocument();
  });
});
