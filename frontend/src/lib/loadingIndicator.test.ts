import { describe, it, expect, vi } from 'vitest';
import {
  startLoading,
  stopLoading,
  startRouteTransition,
  stopRouteTransition,
  subscribeLoading,
} from './loadingIndicator';

describe('loadingIndicator', () => {
  it('notifies subscribers with a loading boolean derived from the in-flight API count', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    startLoading();
    expect(listener).toHaveBeenLastCalledWith(true);

    startLoading();
    expect(listener).toHaveBeenLastCalledWith(true);

    stopLoading();
    expect(listener).toHaveBeenLastCalledWith(true); // one request still in flight

    stopLoading();
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
  });

  it('never goes negative — an extra stopLoading() is a no-op', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    stopLoading();
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);
    unsubscribe();

    startLoading();
    expect(listener).not.toHaveBeenCalled();

    stopLoading(); // rebalance for other tests sharing module state
  });

  it('reports loading while a route transition is pending, independent of the API count', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    startRouteTransition();
    expect(listener).toHaveBeenLastCalledWith(true);

    stopRouteTransition();
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
  });

  it('stays loading if either signal is still active', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    startLoading();
    startRouteTransition();
    expect(listener).toHaveBeenLastCalledWith(true);

    stopRouteTransition();
    expect(listener).toHaveBeenLastCalledWith(true); // the API request is still in flight

    stopLoading();
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
  });

  it('a second startRouteTransition/stopRouteTransition pair does not get lost — it\'s a flag, not a counter', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    startRouteTransition();
    startRouteTransition(); // e.g. pushState firing twice for one navigation
    stopRouteTransition(); // a single "route rendered" signal still clears it
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
  });
});
