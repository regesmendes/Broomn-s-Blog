'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import type { UserSessionsResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { defaultDateRange, toApiRange, formatDateTime } from '@/lib/analytics-format';

export default function UserSessionsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { getToken } = useAuth();
  const [range, setRange] = useState(defaultDateRange());
  const [appliedRange, setAppliedRange] = useState(range);
  const [result, setResult] = useState<UserSessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const sessions = await api.getAnalyticsUserSessions(
        userId,
        token,
        toApiRange(appliedRange.from, appliedRange.to)
      );
      setResult(sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [getToken, userId, appliedRange]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Link
        href="/admin/analytics"
        className="text-sm text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        ← Analytics
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold text-gray-900 dark:text-white">
        {result ? `Sessions — ${result.user.name}` : 'Sessions'}
      </h1>
      {result && <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{result.user.email}</p>}

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

      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-gray-500 dark:text-gray-400">Loading…</p>}

      {!loading && result && (
        result.data.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No sessions in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="py-2 pr-4">First seen</th>
                  <th className="py-2 pr-4">Last seen</th>
                  <th className="py-2 pr-4">Pages</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((session) => (
                  <tr key={session.sessionId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {formatDateTime(session.firstSeen)}
                    </td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                      {formatDateTime(session.lastSeen)}
                    </td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{session.pages}</td>
                    <td className="py-2">
                      <Link
                        href={`/admin/analytics/users/${userId}/sessions/${session.sessionId}`}
                        className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                      >
                        Journey →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
