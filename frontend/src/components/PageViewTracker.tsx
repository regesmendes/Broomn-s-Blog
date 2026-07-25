'use client';

import { usePageViewTracking } from '@/lib/usePageViewTracking';

export function PageViewTracker() {
  usePageViewTracking();
  // Always null, unconditionally — a component mounted at the provider level
  // must never *conditionally* return null (see docs/architecture.md's
  // "Never conditionally return null from a top-level Provider")
  return null;
}
