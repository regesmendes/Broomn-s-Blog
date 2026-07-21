import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  startLoading,
  stopLoading,
  startRouteTransition,
  stopRouteTransition,
  subscribeLoading,
  isInternalNavigationClick,
  watchForNavigationClicks,
} from './loadingIndicator';

/** Dispatches a real click on `el` and returns the event as observed by a
 * document-level listener — the same vantage point isInternalNavigationClick
 * is actually called from. */
function clickOn(el: HTMLElement, overrides: MouseEventInit = {}): MouseEvent {
  let captured: MouseEvent | undefined;
  const capture = (e: Event) => {
    captured = e as MouseEvent;
  };
  document.addEventListener('click', capture);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...overrides }));
  document.removeEventListener('click', capture);
  return captured as MouseEvent;
}

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

describe('isInternalNavigationClick', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is true for a plain left-click on an internal link', () => {
    const a = document.createElement('a');
    a.href = '/admin/posts';
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(a))).toBe(true);
  });

  it('is true for a click on an element nested inside the link', () => {
    const a = document.createElement('a');
    a.href = '/admin/posts';
    const span = document.createElement('span');
    span.textContent = 'Admin';
    a.appendChild(span);
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(span))).toBe(true);
  });

  it('is false for a modified click (new tab, new window, etc.)', () => {
    const a = document.createElement('a');
    a.href = '/admin/posts';
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(a, { ctrlKey: true }))).toBe(false);
    expect(isInternalNavigationClick(clickOn(a, { metaKey: true }))).toBe(false);
    expect(isInternalNavigationClick(clickOn(a, { shiftKey: true }))).toBe(false);
  });

  it('is false for a right/middle click', () => {
    const a = document.createElement('a');
    a.href = '/admin/posts';
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(a, { button: 1 }))).toBe(false);
  });

  it('is false for a same-page hash link', () => {
    const a = document.createElement('a');
    a.href = '#section';
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(a))).toBe(false);
  });

  it('is false for a link to the exact same URL (path + query)', () => {
    const a = document.createElement('a');
    a.href = window.location.pathname + window.location.search;
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(a))).toBe(false);
  });

  it('is false for an external link', () => {
    const a = document.createElement('a');
    a.href = 'https://example.com/somewhere';
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(a))).toBe(false);
  });

  it('is false for a link opening in a new tab (target="_blank")', () => {
    const a = document.createElement('a');
    a.href = '/admin/posts';
    a.target = '_blank';
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(a))).toBe(false);
  });

  it('is false for a download link', () => {
    const a = document.createElement('a');
    a.href = '/files/report.pdf';
    a.setAttribute('download', '');
    document.body.appendChild(a);
    expect(isInternalNavigationClick(clickOn(a))).toBe(false);
  });

  it('is false for a click that is not on a link at all', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(isInternalNavigationClick(clickOn(div))).toBe(false);
  });
});

describe('watchForNavigationClicks', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    stopRouteTransition(); // rebalance shared module state for other tests
  });

  it('flags a route transition the moment an internal link is clicked', () => {
    watchForNavigationClicks();
    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    const a = document.createElement('a');
    a.href = '/admin/posts';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    expect(listener).toHaveBeenLastCalledWith(true);

    unsubscribe();
  });

  it('is idempotent — calling it again does not attach a second listener', () => {
    watchForNavigationClicks();
    watchForNavigationClicks();

    const listener = vi.fn();
    const unsubscribe = subscribeLoading(listener);

    const a = document.createElement('a');
    a.href = '/admin/comments';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    // A double-attached listener would call startRouteTransition() (and
    // therefore notify()) twice for this one click.
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
