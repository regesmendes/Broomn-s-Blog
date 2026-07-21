// Tracks two independent "something is happening" signals and combines them
// into one loading boolean, site-wide. Plain module state (not React
// context) since both signals are driven from outside any single component
// tree: api.ts's request() choke point, and route-level loading.tsx files.

type Listener = (loading: boolean) => void;

let apiCount = 0;
// A boolean, not a counter — a route can (in theory) mount/unmount its
// loading.tsx more than once during a single transition, and a counter
// risks never reaching zero again if a "start" and "stop" don't pair up.
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

/** Called by a route's loading.tsx (see components/RouteLoading.tsx) on mount. */
export function startRouteTransition() {
  routeTransitionPending = true;
  notify();
}

/** Called by the same loading.tsx on unmount, once the real page has taken over. */
export function stopRouteTransition() {
  routeTransitionPending = false;
  notify();
}

/** Returns an unsubscribe function. */
export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
