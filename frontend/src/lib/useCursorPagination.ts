'use client';

import { useCallback, useState } from 'react';

/**
 * Tracks the cursor for "next page" API calls, plus a client-side history
 * stack so "previous" can go back without a backend "previous" endpoint —
 * the same approach used by cursor-paginated APIs like Stripe's or GitHub's.
 */
export function useCursorPagination() {
  const [history, setHistory] = useState<(string | undefined)[]>([undefined]);
  const [index, setIndex] = useState(0);

  const goNext = useCallback(
    (nextCursor: string | null) => {
      if (!nextCursor) return;
      setHistory((h) => [...h.slice(0, index + 1), nextCursor]);
      setIndex((i) => i + 1);
    },
    [index]
  );

  const goPrevious = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const reset = useCallback(() => {
    setHistory([undefined]);
    setIndex(0);
  }, []);

  return {
    cursor: history[index],
    hasPrevious: index > 0,
    goNext,
    goPrevious,
    reset,
  };
}
