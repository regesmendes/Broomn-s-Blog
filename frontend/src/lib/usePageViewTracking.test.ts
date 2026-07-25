import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { usePageViewTracking } from './usePageViewTracking';

let mockPathname = '/';
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => mockPathname,
}));

let mockAuth = { isAuthenticated: true, isLoading: false, getToken: () => 'test-token' };
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth,
}));

const fetchMock = vi.fn().mockResolvedValue({ ok: true });

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function sentBody(callIndex: number) {
  return JSON.parse(fetchMock.mock.calls[callIndex][1].body as string);
}

describe('usePageViewTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    sessionStorage.clear();
    mockPathname = '/';
    mockAuth = { isAuthenticated: true, isLoading: false, getToken: () => 'test-token' };
    setVisibility('visible');
  });

  afterEach(() => {
    // No vitest globals in this project, so RTL's auto-cleanup never runs —
    // without this, unmounted-less hooks keep their window listeners alive
    // across tests and every flush fires once per leaked instance
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does nothing when unauthenticated', () => {
    mockAuth = { ...mockAuth, isAuthenticated: false };
    const { unmount } = renderHook(() => usePageViewTracking());

    vi.advanceTimersByTime(5000);
    window.dispatchEvent(new Event('pagehide'));
    unmount();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates one session id and persists it across flushes', () => {
    renderHook(() => usePageViewTracking());

    vi.advanceTimersByTime(5000);
    setVisibility('hidden');
    setVisibility('visible');
    vi.advanceTimersByTime(5000);
    setVisibility('hidden');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const storedId = sessionStorage.getItem('analyticsSessionId');
    expect(storedId).toBeTruthy();
    expect(sentBody(0).sessionId).toBe(storedId);
    expect(sentBody(1).sessionId).toBe(storedId);
  });

  it('flushes the previous page on route change', () => {
    const { rerender } = renderHook(() => usePageViewTracking());

    vi.advanceTimersByTime(5000);
    mockPathname = '/about';
    rerender();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sentBody(0);
    expect(body.path).toBe('/');
    expect(body.durationMs).toBe(5000);
    expect(fetchMock.mock.calls[0][0]).toContain('/analytics/pageview');
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('flushes on tab hide, excluding hidden time from the next flush', () => {
    renderHook(() => usePageViewTracking());

    vi.advanceTimersByTime(8000);
    setVisibility('hidden');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(0).durationMs).toBe(8000);

    // 60s in the background must not count as time-on-page
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');
    vi.advanceTimersByTime(3000);
    setVisibility('hidden');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(1).durationMs).toBe(3000);
  });

  it('flushes on pagehide', () => {
    renderHook(() => usePageViewTracking());

    vi.advanceTimersByTime(4000);
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(0).path).toBe('/');
    expect(sentBody(0).durationMs).toBe(4000);
  });

  it('never reports the analytics dashboard pages themselves', () => {
    mockPathname = '/admin/analytics';
    const { rerender } = renderHook(() => usePageViewTracking());

    // Neither lingering on the dashboard nor navigating away from it flushes…
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(new Event('pagehide'));
    mockPathname = '/';
    rerender();
    expect(fetchMock).not.toHaveBeenCalled();

    // …but the page navigated to afterwards is tracked normally
    vi.advanceTimersByTime(3000);
    setVisibility('hidden');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(0).path).toBe('/');
  });

  it('skips the near-empty duplicate row when hidden and pagehide fire back to back', () => {
    renderHook(() => usePageViewTracking());

    vi.advanceTimersByTime(5000);
    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
