'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import type { AnalyticsSummary, RequestsByUserRow } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { defaultDateRange, toApiRange } from '@/lib/analytics-format';

const BY_USER_PAGE_SIZE = 20;

function StatCard({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{note}</p>}
    </div>
  );
}

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{children}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const [range, setRange] = useState(defaultDateRange());
  const [appliedRange, setAppliedRange] = useState(range);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "Requests by user" starts collapsed and only fetches once first expanded —
  // no reason to pay for a query nobody may ever look at on every dashboard load.
  const [byUserExpanded, setByUserExpanded] = useState(false);
  const [byUserSearchInput, setByUserSearchInput] = useState('');
  const [byUserSearch, setByUserSearch] = useState('');
  const [byUserOffset, setByUserOffset] = useState(0);
  const [byUser, setByUser] = useState<RequestsByUserRow[]>([]);
  const [byUserTotal, setByUserTotal] = useState(0);
  const [byUserHasMore, setByUserHasMore] = useState(false);
  const [byUserLoading, setByUserLoading] = useState(false);
  const [byUserError, setByUserError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSummary(await api.getAnalyticsSummary(token, toApiRange(appliedRange.from, appliedRange.to)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [getToken, appliedRange]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Changing the date range or the search term invalidates the current page
  useEffect(() => {
    setByUserOffset(0);
  }, [appliedRange, byUserSearch]);

  useEffect(() => {
    if (!byUserExpanded) return;
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        setByUserLoading(true);
        setByUserError(null);
        const result = await api.getAnalyticsRequestsByUser(token, {
          ...toApiRange(appliedRange.from, appliedRange.to),
          limit: BY_USER_PAGE_SIZE,
          offset: byUserOffset,
          search: byUserSearch || undefined,
        });
        if (cancelled) return;
        setByUser(result.data);
        setByUserTotal(result.meta.total);
        setByUserHasMore(result.meta.hasMore);
      } catch (err) {
        if (!cancelled) setByUserError(err instanceof Error ? err.message : 'Failed to load requests by user');
      } finally {
        if (!cancelled) setByUserLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [byUserExpanded, appliedRange, byUserSearch, byUserOffset, getToken]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">
          From
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          To
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>
        <button
          onClick={() => setAppliedRange(range)}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
        >
          Apply
        </button>
      </div>

      <p className="mb-6 text-xs text-gray-400 dark:text-gray-500">
        Raw request/page-view data is retained for 180 days — periods reaching further back
        return partial or empty numbers.
      </p>

      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-gray-500 dark:text-gray-400">Loading…</p>}

      {!loading && summary && (
        <>
          <StatGroup title="Users">
            <StatCard label="Total (all time)" value={summary.users.totalAllTime} />
            <StatCard label="New" value={summary.users.newInPeriod} note="in period" />
          </StatGroup>

          <StatGroup title="Posts">
            <StatCard label="New posts" value={summary.posts.newInPeriod} note="in period" />
            <StatCard label="Reads" value={summary.posts.readsInPeriod} note="in period" />
            <StatCard label="Comments submitted" value={summary.posts.commentsInPeriod} note="in period" />
          </StatGroup>
          <p className="mb-8 -mt-6 text-xs text-gray-400 dark:text-gray-500">
            Reads count only logged-in visitors — this dashboard doesn&apos;t track anonymous traffic.
          </p>

          <StatGroup title="Newsletter">
            <StatCard label="Subscribed" value={summary.newsletter.subscribed} />
            <StatCard label="Unsubscribed" value={summary.newsletter.unsubscribed} />
            <StatCard label="Blocked" value={summary.newsletter.blocked} />
            <StatCard label="Pending" value={summary.newsletter.pending} />
          </StatGroup>

          <StatGroup title="Backend">
            <StatCard label="API requests" value={summary.backend.requestsInPeriod} note="in period" />
          </StatGroup>

          <button
            onClick={() => setByUserExpanded((v) => !v)}
            className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
          >
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {byUserExpanded ? '▾' : '▸'}
            </span>
            Requests by user
          </button>

          {byUserExpanded && (
            <>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Search (name or email)
                  <input
                    type="text"
                    value={byUserSearchInput}
                    onChange={(e) => setByUserSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setByUserSearch(byUserSearchInput);
                    }}
                    placeholder="e.g. alice@example.com"
                    className="mt-1 block w-64 rounded-md border border-gray-300 px-3 py-1.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </label>
                <button
                  onClick={() => setByUserSearch(byUserSearchInput)}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
                >
                  Search
                </button>
              </div>

              {byUserError && <p className="mb-4 text-red-600 dark:text-red-400">{byUserError}</p>}
              {byUserLoading && <p className="text-gray-500 dark:text-gray-400">Loading…</p>}

              {!byUserLoading && byUser.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  {byUserSearch
                    ? 'No users match that search in this period.'
                    : 'No authenticated requests in this period.'}
                </p>
              ) : (
                !byUserLoading && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            <th className="py-2 pr-4">User</th>
                            <th className="py-2 pr-4">Email</th>
                            <th className="py-2 pr-4">Requests</th>
                            <th className="py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {byUser.map((row) => (
                            <tr key={row.userId} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 pr-4 text-gray-900 dark:text-white">{row.name}</td>
                              <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{row.email}</td>
                              <td className="py-2 pr-4 text-gray-900 dark:text-white">{row.requests}</td>
                              <td className="py-2">
                                <Link
                                  href={`/admin/analytics/users/${row.userId}`}
                                  className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                                >
                                  Sessions →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        Showing {byUserOffset + 1}–{Math.min(byUserOffset + BY_USER_PAGE_SIZE, byUserTotal)} of{' '}
                        {byUserTotal}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setByUserOffset((o) => Math.max(0, o - BY_USER_PAGE_SIZE))}
                          disabled={byUserOffset === 0}
                          className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-600"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setByUserOffset((o) => o + BY_USER_PAGE_SIZE)}
                          disabled={!byUserHasMore}
                          className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-600"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
