'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import type { AnalyticsSummary, RequestsByUserRow } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { defaultDateRange, toApiRange } from '@/lib/analytics-format';

function StatCard({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{note}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const [range, setRange] = useState(defaultDateRange());
  const [appliedRange, setAppliedRange] = useState(range);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [byUser, setByUser] = useState<RequestsByUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const apiRange = toApiRange(appliedRange.from, appliedRange.to);
      const [summaryResult, byUserResult] = await Promise.all([
        api.getAnalyticsSummary(token, apiRange),
        api.getAnalyticsRequestsByUser(token, apiRange),
      ]);
      setSummary(summaryResult);
      setByUser(byUserResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [getToken, appliedRange]);

  useEffect(() => {
    load();
  }, [load]);

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
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Users (all time)" value={summary.users.totalAllTime} />
            <StatCard label="New users" value={summary.users.newInPeriod} note="in period" />
            <StatCard label="API requests" value={summary.requests.totalInPeriod} note="in period" />
            <StatCard label="Subscribed" value={summary.newsletter.subscribed} />
            <StatCard label="Unsubscribed" value={summary.newsletter.unsubscribed} />
            <StatCard label="Blocked" value={summary.newsletter.blocked} />
          </div>
          <p className="mb-8 -mt-6 text-xs text-gray-400 dark:text-gray-500">
            Newsletter counts exclude pending (unconfirmed) subscriptions — the three numbers
            don&apos;t sum to all rows.
          </p>

          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Requests by user
          </h2>
          {byUser.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No authenticated requests in this period.</p>
          ) : (
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
          )}
        </>
      )}
    </div>
  );
}
