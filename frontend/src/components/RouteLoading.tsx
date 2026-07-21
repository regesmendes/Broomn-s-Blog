'use client';

import { useEffect } from 'react';
import { startRouteTransition, stopRouteTransition } from '@/lib/loadingIndicator';

/**
 * Drop into a route segment's loading.tsx. Next.js mounts this as a
 * Suspense fallback for a route transition and unmounts it once the real
 * page takes over — but measured empirically (Playwright against the real
 * dev server, see docs/architecture.md), in dev mode it does NOT mount at
 * the instant navigation begins: Next can't show the fallback until it has
 * already resolved enough of the new segment's chunk request to know one is
 * needed, so the mount only happens in the last few hundred ms before the
 * real page is ready, not for the full multi-second dev-mode compile a
 * first visit to a route pays. That's a real but narrow gap — this
 * component still contributes correctly for the tail end of a transition,
 * and matters most for navigations with no click to hook (e.g.
 * ProtectedRoute's programmatic router.push redirects). The click listener
 * in lib/loadingIndicator.ts (watchForNavigationClicks) is what actually
 * covers the full click-to-ready window for link-driven navigations.
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
