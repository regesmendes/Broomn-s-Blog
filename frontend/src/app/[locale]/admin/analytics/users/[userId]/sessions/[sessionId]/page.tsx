'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import type { SessionJourney } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDuration, formatDateTime } from '@/lib/analytics-format';

export default function SessionJourneyPage({
  params,
}: {
  params: Promise<{ userId: string; sessionId: string }>;
}) {
  const { userId, sessionId } = use(params);
  const { getToken } = useAuth();
  const [journey, setJourney] = useState<SessionJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setJourney(await api.getAnalyticsSessionJourney(userId, sessionId, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [getToken, userId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Link
        href={`/admin/analytics/users/${userId}`}
        className="text-sm text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        ← Sessions
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold text-gray-900 dark:text-white">Session journey</h1>

      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-gray-500 dark:text-gray-400">Loading…</p>}

      {!loading && journey && (
        <ol className="relative border-l border-gray-200 pl-6 dark:border-gray-700">
          {journey.pageViews.map((view) => (
            <li key={view.id} className="mb-6">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-emerald-500" />
              <p className="font-mono text-sm text-gray-900 dark:text-white">{view.path}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(view.enteredAt)} · {formatDuration(view.durationMs)} on page
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
