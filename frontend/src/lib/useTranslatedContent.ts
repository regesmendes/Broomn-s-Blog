'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { translateHtml } from '@/lib/translate';

/** Shared translation state for a post/About page body, lifted out of
 * PostContent so the toggle control can render elsewhere (e.g. next to the
 * title) while the content still shares the same state. */
export function useTranslatedContent(content: string) {
  const locale = useLocale();
  const [displayContent, setDisplayContent] = useState(content);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');
  const cacheRef = useRef<string | null>(null);

  const handleTranslate = useCallback(async () => {
    setError('');

    if (cacheRef.current) {
      setDisplayContent(cacheRef.current);
      setIsTranslated(true);
      return;
    }

    setTranslating(true);

    try {
      const translatedHtml = await translateHtml(content, 'pt|en');
      cacheRef.current = translatedHtml;
      setDisplayContent(translatedHtml);
      setIsTranslated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
      setDisplayContent(content);
    } finally {
      setTranslating(false);
    }
  }, [content]);

  // Auto-translate on mount if locale is English (posts are written in Portuguese)
  useEffect(() => {
    if (locale === 'en') {
      handleTranslate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  function toggle() {
    if (isTranslated) {
      setDisplayContent(content);
      setIsTranslated(false);
    } else if (cacheRef.current) {
      setDisplayContent(cacheRef.current);
      setIsTranslated(true);
    } else {
      handleTranslate();
    }
  }

  return { displayContent, isTranslated, translating, error, toggle };
}
