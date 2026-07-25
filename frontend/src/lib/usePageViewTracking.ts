'use client';

// Page-view tracking for the internal analytics dashboard (registered users
// only — the hook is a no-op until auth resolves to a logged-in user).
//
// Deliberately bypasses api.ts's shared request() wrapper: that wrapper drives
// the global loading spinner, which is wrong for a background beacon
// (uploadMedia already sets this precedent). And it must be fetch keepalive,
// not navigator.sendBeacon — sendBeacon can't attach the Authorization header
// this bearer-token API needs.

import { useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SESSION_ID_KEY = 'analyticsSessionId';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

function sendPageView(token: string, path: string, durationMs: number) {
  // The analytics dashboard must never appear in its own reports — time spent
  // reviewing analytics is not part of anyone's journey (the API drops these
  // server-side too, this just saves the pointless request)
  if (path.startsWith('/admin/analytics')) return;

  fetch(`${API_URL}/analytics/pageview`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path, sessionId: getSessionId(), durationMs }),
  }).catch(() => {
    // Fire-and-forget: unload-time keepalive fetches aren't guaranteed to
    // complete on every browser — an accepted tradeoff, never surfaced
  });
}

export function usePageViewTracking() {
  // usePathname from @/i18n/navigation is locale-stripped — /pt/x and /en/x
  // must count as the same page
  const pathname = usePathname();
  const { isAuthenticated, isLoading, getToken } = useAuth();

  const enteredAtRef = useRef<number>(Date.now());
  // Refs so the visibility/pagehide listeners never see stale values
  const pathRef = useRef(pathname);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const enabled = isAuthenticated && !isLoading;

  // Trigger 1: route change — the effect cleanup flushes the page being left
  useEffect(() => {
    if (!enabled) return;

    pathRef.current = pathname;
    enteredAtRef.current = Date.now();

    return () => {
      const token = getTokenRef.current();
      if (token) {
        sendPageView(token, pathname, Date.now() - enteredAtRef.current);
      }
    };
  }, [pathname, enabled]);

  // Triggers 2 & 3: tab hidden / page unload
  useEffect(() => {
    if (!enabled) return;

    const flush = () => {
      const durationMs = Date.now() - enteredAtRef.current;
      // A hidden-then-close sequence fires both handlers back to back —
      // skip the near-empty second row instead of double-counting the page
      if (durationMs < 1000) return;

      const token = getTokenRef.current();
      if (token) {
        sendPageView(token, pathRef.current, durationMs);
      }
      enteredAtRef.current = Date.now();
    };

    // 'hidden' matters most: a backgrounded tab never fires pagehide, so
    // without this a close-from-background loses the whole page view
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      } else {
        // Back from background — don't count the hidden time as time-on-page
        enteredAtRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [enabled]);
}
