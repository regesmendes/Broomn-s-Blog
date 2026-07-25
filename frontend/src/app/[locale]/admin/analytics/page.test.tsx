import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AnalyticsPage from './page';
import api from '@/lib/api';

vi.mock('@/i18n/navigation', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ getToken: () => 'test-token' }),
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

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders stat cards and the requests-by-user table', async () => {
    mockApi.getAnalyticsSummary.mockResolvedValue({
      period: { from: '2026-06-25T00:00:00.000Z', to: '2026-07-25T23:59:59.999Z' },
      users: { totalAllTime: 42, newInPeriod: 5 },
      requests: { totalInPeriod: 1234 },
      newsletter: { subscribed: 30, unsubscribed: 8, blocked: 2 },
    });
    mockApi.getAnalyticsRequestsByUser.mockResolvedValue({
      period: { from: '2026-06-25T00:00:00.000Z', to: '2026-07-25T23:59:59.999Z' },
      data: [{ userId: 'user-1', email: 'alice@example.com', name: 'Alice', requests: 100 }],
    });

    render(<AnalyticsPage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Sessions →')).toHaveAttribute(
      'href',
      '/admin/analytics/users/user-1'
    );
  });

  it('shows an empty state when no requests were logged', async () => {
    mockApi.getAnalyticsSummary.mockResolvedValue({
      period: { from: '2026-06-25T00:00:00.000Z', to: '2026-07-25T23:59:59.999Z' },
      users: { totalAllTime: 0, newInPeriod: 0 },
      requests: { totalInPeriod: 0 },
      newsletter: { subscribed: 0, unsubscribed: 0, blocked: 0 },
    });
    mockApi.getAnalyticsRequestsByUser.mockResolvedValue({
      period: { from: '2026-06-25T00:00:00.000Z', to: '2026-07-25T23:59:59.999Z' },
      data: [],
    });

    render(<AnalyticsPage />);

    expect(
      await screen.findByText('No authenticated requests in this period.')
    ).toBeInTheDocument();
  });

  it('surfaces load errors', async () => {
    mockApi.getAnalyticsSummary.mockRejectedValue(new Error('boom'));
    mockApi.getAnalyticsRequestsByUser.mockResolvedValue({ period: {}, data: [] });

    render(<AnalyticsPage />);

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
