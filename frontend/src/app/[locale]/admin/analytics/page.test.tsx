import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AnalyticsPage from './page';
import api from '@/lib/api';

vi.mock('@/i18n/navigation', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

// getToken must be a stable reference across renders — this page's effects
// depend on it, and a fresh arrow function per useAuth() call would make
// them re-fire on every render (same gotcha documented in media/page.test.tsx)
const mockGetToken = vi.fn(() => 'test-token');
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('@/lib/api', () => ({
  default: {
    getAnalyticsSummary: vi.fn(),
    getAnalyticsRequestsByUser: vi.fn(),
  },
}));

const mockApi = api as unknown as {
  getAnalyticsSummary: ReturnType<typeof vi.fn>;
  getAnalyticsRequestsByUser: ReturnType<typeof vi.fn>;
};

const summaryFixture = {
  period: { from: '2026-06-25T00:00:00.000Z', to: '2026-07-25T23:59:59.999Z' },
  users: { totalAllTime: 42, newInPeriod: 5 },
  posts: { newInPeriod: 3, readsInPeriod: 120, commentsInPeriod: 17 },
  newsletter: {
    subscribed: 30,
    unsubscribed: 8,
    blocked: 2,
    pending: 6,
    subscribedInPeriod: 9,
    unsubscribedInPeriod: 4,
  },
  backend: { requestsInPeriod: 1234 },
};

function byUserFixture(overrides: Partial<{ data: unknown[]; meta: object }> = {}) {
  return {
    period: summaryFixture.period,
    data: [{ userId: 'user-1', email: 'alice@example.com', name: 'Alice', requests: 100 }],
    meta: { offset: 0, limit: 20, total: 1, hasMore: false },
    ...overrides,
  };
}

async function expandByUserSection() {
  fireEvent.click(await screen.findByText(/Requests by user/));
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders grouped stat cards without fetching requests-by-user', async () => {
    mockApi.getAnalyticsSummary.mockResolvedValue(summaryFixture);

    render(<AnalyticsPage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('New subscribers')).toBeInTheDocument();
    expect(screen.getByText('New unsubscribes')).toBeInTheDocument();

    // Users and Backend sit side by side at the top, above Posts and Newsletter
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Users', 'Backend', 'Posts', 'Newsletter']);

    // "Requests by user" starts collapsed — no reason to pay for a query
    // nobody may ever look at on every dashboard load
    expect(mockApi.getAnalyticsRequestsByUser).not.toHaveBeenCalled();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('fetches and shows the requests-by-user table only once expanded', async () => {
    mockApi.getAnalyticsSummary.mockResolvedValue(summaryFixture);
    mockApi.getAnalyticsRequestsByUser.mockResolvedValue(byUserFixture());

    render(<AnalyticsPage />);
    await screen.findByText('42');
    expect(mockApi.getAnalyticsRequestsByUser).not.toHaveBeenCalled();

    await expandByUserSection();

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Sessions →')).toHaveAttribute('href', '/admin/analytics/users/user-1');
    expect(mockApi.getAnalyticsRequestsByUser).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when no requests were logged', async () => {
    mockApi.getAnalyticsSummary.mockResolvedValue(summaryFixture);
    mockApi.getAnalyticsRequestsByUser.mockResolvedValue(
      byUserFixture({ data: [], meta: { offset: 0, limit: 20, total: 0, hasMore: false } })
    );

    render(<AnalyticsPage />);
    await screen.findByText('42');
    await expandByUserSection();

    expect(
      await screen.findByText('No authenticated requests in this period.')
    ).toBeInTheDocument();
  });

  it('searches by name/email, resetting to the first page', async () => {
    mockApi.getAnalyticsSummary.mockResolvedValue(summaryFixture);
    mockApi.getAnalyticsRequestsByUser.mockResolvedValue(byUserFixture());

    render(<AnalyticsPage />);
    await screen.findByText('42');
    await expandByUserSection();
    await screen.findByText('Alice');

    mockApi.getAnalyticsRequestsByUser.mockResolvedValue(
      byUserFixture({
        data: [{ userId: 'user-2', email: 'carol@example.com', name: 'Carol', requests: 5 }],
        meta: { offset: 0, limit: 20, total: 1, hasMore: false },
      })
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. alice@example.com'), {
      target: { value: 'carol' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Carol')).toBeInTheDocument();
    const lastCall = mockApi.getAnalyticsRequestsByUser.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual(expect.objectContaining({ search: 'carol', offset: 0 }));
  });

  it('shows a search-specific empty state when nothing matches', async () => {
    mockApi.getAnalyticsSummary.mockResolvedValue(summaryFixture);
    mockApi.getAnalyticsRequestsByUser.mockResolvedValue(
      byUserFixture({ data: [], meta: { offset: 0, limit: 20, total: 0, hasMore: false } })
    );

    render(<AnalyticsPage />);
    await screen.findByText('42');
    await expandByUserSection();

    fireEvent.change(screen.getByPlaceholderText('e.g. alice@example.com'), {
      target: { value: 'nobody' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('No users match that search in this period.')).toBeInTheDocument();
  });

  it('paginates with Previous/Next, disabling at the ends', async () => {
    mockApi.getAnalyticsSummary.mockResolvedValue(summaryFixture);
    mockApi.getAnalyticsRequestsByUser.mockResolvedValue(
      byUserFixture({ meta: { offset: 0, limit: 20, total: 45, hasMore: true } })
    );

    render(<AnalyticsPage />);
    await screen.findByText('42');
    await expandByUserSection();
    await screen.findByText('Alice');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
    expect(screen.getByText('Showing 1–20 of 45')).toBeInTheDocument();

    mockApi.getAnalyticsRequestsByUser.mockResolvedValue(
      byUserFixture({
        data: [{ userId: 'user-9', email: 'z@example.com', name: 'Zed', requests: 1 }],
        meta: { offset: 20, limit: 20, total: 45, hasMore: true },
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Zed')).toBeInTheDocument();
    expect(screen.getByText('Showing 21–40 of 45')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled();
    const lastCall = mockApi.getAnalyticsRequestsByUser.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual(expect.objectContaining({ offset: 20 }));
  });

  it('surfaces load errors', async () => {
    mockApi.getAnalyticsSummary.mockRejectedValue(new Error('boom'));

    render(<AnalyticsPage />);

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
