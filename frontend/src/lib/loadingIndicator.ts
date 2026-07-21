// Tracks "something is happening" signals and combines them into one loading
// boolean, site-wide. Plain module state (not React context) since these are
// driven from outside any single component tree: api.ts's request() choke
// point, a route's loading.tsx (see components/RouteLoading.tsx), and a
// global click listener that flags a route transition the moment a click on
// an internal link is observed (see watchForNavigationClicks below).

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

// A safety net: if a click looked like internal navigation but nothing ever
// clears the flag (e.g. something cancelled the navigation after our
// listener saw it), don't leave the spinner stuck forever.
const ROUTE_TRANSITION_SAFETY_NET_MS = 10_000;

/**
 * True if a click event is heading to a same-origin, same-tab, real page
 * change — i.e. it's about to trigger a client-side navigation, whether or
 * not Next's own router internals expose that fact to us directly.
 *
 * Deliberately does NOT bail out on event.defaultPrevented: Next's <Link>
 * (and next-intl's wrapper around it) always calls preventDefault() in its
 * own onClick handler before doing a client-side router.push — that's how
 * every Link click actually looks by the time any listener sees it. An
 * earlier version of this check bailed on that flag, which meant it silently
 * rejected 100% of real Link clicks (confirmed with a Playwright probe — see
 * docs/architecture.md). watchForNavigationClicks (below) also listens in
 * the capture phase specifically so we see the event before React's
 * delegated bubble-phase listener has a chance to call preventDefault, but
 * this function no longer depends on that ordering to be correct.
 */
export function isInternalNavigationClick(event: MouseEvent): boolean {
  if (event.button !== 0) return false; // left-click only
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false; // opening in a new tab etc. — leave alone

  const target = event.target;
  if (!(target instanceof Element)) return false;
  const anchor = target.closest('a');
  if (!anchor) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  // Same path+query — e.g. a same-page hash link — isn't a route change.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;

  return true;
}

let clickListenerAttached = false;

/**
 * Starts a route transition the moment a real click on an internal link is
 * observed. Registered with { capture: true } so it fires during the
 * capture phase, before React's own delegated click listener — which for
 * the App Router is attached directly on `document` too, since the root
 * layout renders <html>/<body> and React hydrates from `document` itself.
 * Both listeners being on the same node means plain bubble-phase order
 * would depend on registration order (React's is attached during initial
 * hydration, ours during a component effect that runs later — so React's
 * Link onClick, which calls preventDefault() and then router.push, would
 * always run first). Capture fires before any bubble-phase listener on the
 * same target, regardless of registration order, which is what actually
 * makes this reliable. Safe to call more than once; only attaches once.
 */
export function watchForNavigationClicks() {
  if (clickListenerAttached || typeof document === 'undefined') return;
  clickListenerAttached = true;

  document.addEventListener(
    'click',
    (event) => {
      if (!isInternalNavigationClick(event)) return;
      startRouteTransition();
      setTimeout(stopRouteTransition, ROUTE_TRANSITION_SAFETY_NET_MS);
    },
    { capture: true },
  );
}
