'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { translatePlainText } from '@/lib/translate';

interface TranslatableTitleProps {
  title: string;
  className?: string;
}

/** Translates a post title to English when the locale is 'en', mirroring
 * TranslatablePostCard's title translation on the home page. */
export function TranslatableTitle({ title, className }: TranslatableTitleProps) {
  const locale = useLocale();
  const [displayTitle, setDisplayTitle] = useState(title);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (locale !== 'en') return;

    let cancelled = false;
    setTranslating(true);

    translatePlainText(title, 'pt|en')
      .then((translated) => {
        if (!cancelled) setDisplayTitle(translated);
      })
      .catch(() => {
        if (!cancelled) setDisplayTitle(title);
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locale, title]);

  return (
    <h1 className={className}>
      {translating ? (
        <span className="animate-pulse text-gray-400 dark:text-gray-500">{title}</span>
      ) : (
        displayTitle
      )}
    </h1>
  );
}
