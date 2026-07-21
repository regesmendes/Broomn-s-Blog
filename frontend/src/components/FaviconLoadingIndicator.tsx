'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ensureHistoryPatched, stopRouteTransition, subscribeLoading } from '@/lib/loadingIndicator';

const FRAME_COUNT = 8;
const FRAME_INTERVAL_MS = 120;
// Only start spinning if a request is still in flight after this delay —
// skips the flicker of a flash-then-restore on requests that resolve fast.
const SHOW_DELAY_MS = 200;

function spinnerFrameHref(step: number): string {
  const angle = (360 / FRAME_COUNT) * step;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<circle cx="16" cy="16" r="12" fill="none" stroke="#059669" stroke-width="4" ' +
    `stroke-linecap="round" stroke-dasharray="56.5 18.8" transform="rotate(${angle} 16 16)"/>` +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Swaps the tab's favicon for a small spinning ring while an API request is
 * in flight OR a route transition is underway (see lib/loadingIndicator.ts),
 * so a click has some visible sign of life beyond the page itself — including
 * during dev-mode route compilation, which happens before any fetch call.
 */
export function FaviconLoadingIndicator() {
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalHrefsRef = useRef<{ el: HTMLLinkElement; href: string }[] | null>(null);
  const pathname = usePathname();

  // pushState/replaceState (patched below) flag the start of a navigation;
  // this effect firing means the new route has actually rendered — the
  // correct "stop" signal, since it only runs after commit.
  useEffect(() => {
    stopRouteTransition();
  }, [pathname]);

  useEffect(() => {
    ensureHistoryPatched();
    const startSpinning = () => {
      if (spinIntervalRef.current) return;

      const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
      originalHrefsRef.current = links.map((el) => ({ el, href: el.href }));

      let step = 0;
      const paint = () => {
        const frame = spinnerFrameHref(step);
        links.forEach((el) => {
          el.href = frame;
        });
        step = (step + 1) % FRAME_COUNT;
      };

      paint(); // show the first frame right away, not after the first interval tick
      spinIntervalRef.current = setInterval(paint, FRAME_INTERVAL_MS);
    };

    const stopSpinning = () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      originalHrefsRef.current?.forEach(({ el, href }) => {
        el.href = href;
      });
      originalHrefsRef.current = null;
    };

    const unsubscribe = subscribeLoading((loading) => {
      if (loading) {
        if (showTimeoutRef.current || spinIntervalRef.current) return;
        showTimeoutRef.current = setTimeout(() => {
          showTimeoutRef.current = null;
          startSpinning();
        }, SHOW_DELAY_MS);
      } else {
        if (showTimeoutRef.current) {
          clearTimeout(showTimeoutRef.current);
          showTimeoutRef.current = null;
        }
        stopSpinning();
      }
    });

    return () => {
      unsubscribe();
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      stopSpinning();
    };
  }, []);

  return null;
}
