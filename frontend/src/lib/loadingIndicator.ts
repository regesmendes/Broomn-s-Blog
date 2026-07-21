// Tracks two independent "something is happening" signals and combines them
// into one loading boolean, site-wide. Plain module state (not React
// context) since both signals are driven from outside any component tree:
// api.ts's single request() choke point, and a patched History API.

type Listener = (loading: boolean) => void;

let apiCount = 0;
// A boolean, not a counter — pushState/replaceState can fire more than once
// per navigation, and a counter would risk never reaching zero again if a
// single "stop" doesn't match every "start".
let routeTransitionPending = false;
const listeners = new Set<Listener>();

function notify() {
  const loading = apiCount > 0 || routeTransitionPending;
  listeners.forEach((listener) => listener(loading));
}

export function startLoading() {
  apiCount += 1;
  notify();
}

export function stopLoading() {
  apiCount = Math.max(0, apiCount - 1);
  notify();
}

export function startRouteTransition() {
  routeTransitionPending = true;
  notify();
}

export function stopRouteTransition() {
  routeTransitionPending = false;
  notify();
}

/** Returns an unsubscribe function. */
export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let historyPatched = false;

/**
 * Patches history.pushState/replaceState to flag a route transition as
 * started — the App Router has no official "navigation started" event, but
 * every client-side navigation (Link, router.push, router.replace) goes
 * through these two calls under the hood. Safe to call more than once
 * (e.g. React StrictMode double-invoking an effect); only patches once.
 */
export function ensureHistoryPatched() {
  if (historyPatched || typeof window === 'undefined') return;
  historyPatched = true;

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
    startRouteTransition();
    return originalPushState(...args);
  };

  window.history.replaceState = function (...args: Parameters<typeof window.history.replaceState>) {
    startRouteTransition();
    return originalReplaceState(...args);
  };

  window.addEventListener('popstate', () => startRouteTransition());
}
