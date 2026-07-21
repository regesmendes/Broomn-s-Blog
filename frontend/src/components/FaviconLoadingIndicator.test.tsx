import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { FaviconLoadingIndicator } from './FaviconLoadingIndicator';
import { startLoading, stopLoading } from '@/lib/loadingIndicator';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/pt'),
}));

const mockUsePathname = vi.mocked(usePathname);

describe('FaviconLoadingIndicator', () => {
  let link: HTMLLinkElement;

  beforeEach(() => {
    vi.useFakeTimers();
    mockUsePathname.mockReturnValue('/pt');
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

  it('spins on a route transition alone — a click that triggers no API request at all', async () => {
    const { rerender } = render(<FaviconLoadingIndicator />);
    const originalHref = link.href;

    // Exercises the real patched history.pushState — this is what Next's
    // router calls under the hood for a client-side navigation, before the
    // new route has even started rendering (let alone fetching anything).
    act(() => {
      window.history.pushState({}, '', '/pt/admin/posts');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(link.href).not.toBe(originalHref);

    // The new route "renders" — usePathname's effect firing is the stop signal.
    mockUsePathname.mockReturnValue('/pt/admin/posts');
    rerender(<FaviconLoadingIndicator />);

    expect(link.href).toBe(originalHref);
  });
});
