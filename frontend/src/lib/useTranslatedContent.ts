'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { translateHtml } from '@/lib/translate';

/** Auto-translates a post/About page body to English when the locale is
 * 'en' (content is authored in Portuguese) — no manual toggle. The language
 * selector already covers "see the Portuguese original" by navigating to
 * /pt, so a separate in-page toggle was redundant. */
export function useTranslatedContent(content: string) {
  const locale = useLocale();
  const [displayContent, setDisplayContent] = useState(content);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');

  const handleTranslate = useCallback(async () => {
    setError('');
    setTranslating(true);

    try {
      const translatedHtml = await translateHtml(content, 'pt|en');
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

  return { displayContent, isTranslated, translating, error };
}
