// Tracks how many API requests are currently in flight, site-wide. Plain
// module state (not React context) since it's driven from api.ts's single
// request() choke point, outside any component tree.

type Listener = (count: number) => void;

let count = 0;
const listeners = new Set<Listener>();

export function startLoading() {
  count += 1;
  listeners.forEach((listener) => listener(count));
}

export function stopLoading() {
  count = Math.max(0, count - 1);
  listeners.forEach((listener) => listener(count));
}

/** Returns an unsubscribe function. */
export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
