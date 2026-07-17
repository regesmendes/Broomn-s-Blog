'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  const locale = useLocale();
  const t = useTranslations('post');
  const [displayContent, setDisplayContent] = useState(content);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');
  const cacheRef = useRef<string | null>(null);

  // Auto-translate on mount if locale is English (posts are written in Portuguese)
  useEffect(() => {
    if (locale === 'en') {
      handleTranslate();
    }
  }, [locale]);

  async function handleTranslate() {
    setError('');

    if (cacheRef.current) {
      setDisplayContent(cacheRef.current);
      setIsTranslated(true);
      return;
    }

    setTranslating(true);

    try {
      // Split HTML content into chunks (MyMemory has ~500 char limit)
      const chunks = splitHtmlContent(content, 450);
      const translatedChunks: string[] = [];

      for (const chunk of chunks) {
        const params = new URLSearchParams({
          q: chunk,
          langpair: 'pt|en',
        });

        const response = await fetch(`${MYMEMORY_URL}?${params}`);

        if (!response.ok) {
          throw new Error(`Translation service returned ${response.status}`);
        }

        const data = await response.json();
        if (data.responseStatus !== 200) {
          throw new Error(data.responseDetails || 'Translation failed');
        }

        translatedChunks.push(data.responseData.translatedText);
      }

      const translatedHtml = translatedChunks.join('');
      cacheRef.current = translatedHtml;
      setDisplayContent(translatedHtml);
      setIsTranslated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
      setDisplayContent(content);
    } finally {
      setTranslating(false);
    }
  }

  function handleShowOriginal() {
    setDisplayContent(content);
    setIsTranslated(false);
  }

  function handleShowTranslated() {
    if (cacheRef.current) {
      setDisplayContent(cacheRef.current);
      setIsTranslated(true);
    } else {
      handleTranslate();
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start gap-2">
        {translating ? (
          <span className="text-sm italic text-gray-500 dark:text-gray-400">
            {t('translating')}
          </span>
        ) : (
          <button
            onClick={isTranslated ? handleShowOriginal : handleShowTranslated}
            className="cursor-pointer rounded-md border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900"
          >
            {isTranslated ? t('showOriginal') : t('translateButton')}
          </button>
        )}

        {isTranslated && (
          <p className="text-xs italic text-gray-500 dark:text-gray-400">
            {t('translatedDisclaimer')}
          </p>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Split HTML content into chunks that respect tag boundaries.
 * Splits on block-level elements (p, h1-h6, li, blockquote, etc.)
 * to keep each chunk as valid HTML.
 */
function splitHtmlContent(html: string, maxLength: number): string[] {
  // Split on block-level closing tags
  const blocks = html.split(/(?<=<\/(?:p|h[1-6]|li|blockquote|div|pre)>)/i);
  const chunks: string[] = [];
  let current = '';

  for (const block of blocks) {
    if ((current + block).length > maxLength && current) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [html];
}
