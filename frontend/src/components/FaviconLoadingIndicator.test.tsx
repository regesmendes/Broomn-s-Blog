import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { FaviconLoadingIndicator } from './FaviconLoadingIndicator';
import { startLoading, stopLoading, startRouteTransition, stopRouteTransition } from '@/lib/loadingIndicator';

describe('FaviconLoadingIndicator', () => {
  let link: HTMLLinkElement;

  beforeEach(() => {
    vi.useFakeTimers();
    link = document.createElement('link');
    link.rel = 'icon';
    link.href = '/favicon.png';
    document.head.appendChild(link);
  });

  afterEach(() => {
    cleanup();
    document.head.removeChild(link);
    vi.useRealTimers();
  });

  it('leaves the favicon untouched for a request that resolves before the show delay', async () => {
    render(<FaviconLoadingIndicator />);
    const originalHref = link.href;

    act(() => startLoading());
    act(() => {
      vi.advanceTimersByTime(100); // under the 200ms show delay
    });
    act(() => stopLoading());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(link.href).toBe(originalHref);
  });

  it('swaps the favicon to a spinner frame once loading outlasts the show delay, and restores it after', async () => {
    render(<FaviconLoadingIndicator />);
    const originalHref = link.href;

    act(() => startLoading());
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(link.href).not.toBe(originalHref);
    expect(link.href).toContain('data:image/svg+xml');

    act(() => stopLoading());

    expect(link.href).toBe(originalHref);
  });

  it('cycles through spinner frames while still loading', async () => {
    render(<FaviconLoadingIndicator />);

    act(() => startLoading());
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const firstFrame = link.href;

    act(() => {
      vi.advanceTimersByTime(120);
    });
    const secondFrame = link.href;

    expect(secondFrame).not.toBe(firstFrame);

    act(() => stopLoading());
  });

  it('spins while a route\'s loading.tsx is mounted, even with no API request at all', async () => {
    render(<FaviconLoadingIndicator />);
    const originalHref = link.href;

    // This is exactly what RouteLoading (a route's loading.tsx) calls on
    // mount/unmount — no fetch involved, just the Suspense fallback lifecycle.
    act(() => startRouteTransition());
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(link.href).not.toBe(originalHref);

    act(() => stopRouteTransition());

    expect(link.href).toBe(originalHref);
  });
});
