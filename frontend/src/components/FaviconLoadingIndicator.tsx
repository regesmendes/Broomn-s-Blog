'use client';

import { useEffect, useRef } from 'react';
import { subscribeLoading } from '@/lib/loadingIndicator';

const FRAME_COUNT = 8;
const FRAME_INTERVAL_MS = 120;
// Only start spinning if loading is still ongoing after this delay — skips
// the flicker of a flash-then-restore on things that resolve fast.
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
 * in flight OR a route's loading.tsx is mounted (see lib/loadingIndicator.ts),
 * so a click has some visible sign of life beyond the page itself.
 */
export function FaviconLoadingIndicator() {
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalHrefsRef = useRef<{ el: HTMLLinkElement; href: string }[] | null>(null);

  useEffect(() => {
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
