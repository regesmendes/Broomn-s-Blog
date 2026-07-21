'use client';

import { useEffect } from 'react';
import { startRouteTransition, stopRouteTransition } from '@/lib/loadingIndicator';

/**
 * Drop into a route segment's loading.tsx. Next.js mounts this as a Suspense
 * fallback the instant navigation into that segment begins — including
 * during dev-mode compilation, before the real page's own code has even
 * loaded — and unmounts it the moment the real page takes over, which is
 * exactly the start/stop signal the favicon spinner needs.
 */
export function RouteLoading() {
  useEffect(() => {
    startRouteTransition();
    return () => stopRouteTransition();
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 dark:border-emerald-900 dark:border-t-emerald-400" />
    </div>
  );
}
