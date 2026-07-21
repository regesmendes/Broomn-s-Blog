import { describe, it, expect, vi } from 'vitest';
import { startLoading, stopLoading, subscribeLoading } from './loadingIndicator';

describe('loadingIndicator', () => {
  it('notifies subscribers with the current in-flight count', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    startLoading();
    expect(listener).toHaveBeenLastCalledWith(1);

    startLoading();
    expect(listener).toHaveBeenLastCalledWith(2);

    stopLoading();
    expect(listener).toHaveBeenLastCalledWith(1);

    stopLoading();
    expect(listener).toHaveBeenLastCalledWith(0);

    unsubscribe();
  });

  it('never goes below zero', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    stopLoading();
    expect(listener).toHaveBeenLastCalledWith(0);

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
});
