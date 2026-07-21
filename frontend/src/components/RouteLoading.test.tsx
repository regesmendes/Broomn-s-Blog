import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RouteLoading } from './RouteLoading';
import * as loadingIndicator from '@/lib/loadingIndicator';

describe('RouteLoading', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('signals a route transition start on mount and stop on unmount', () => {
    const startSpy = vi.spyOn(loadingIndicator, 'startRouteTransition');
    const stopSpy = vi.spyOn(loadingIndicator, 'stopRouteTransition');

    const { unmount } = render(<RouteLoading />);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).not.toHaveBeenCalled();

    unmount();
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
