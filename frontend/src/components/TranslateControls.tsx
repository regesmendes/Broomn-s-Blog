'use client';

import { useTranslations } from 'next-intl';
import { useTranslationContext } from './TranslationProvider';

export function TranslateControls() {
  const { translating, isTranslated, error, toggle } = useTranslationContext();
  const t = useTranslations('post');

  return (
    <div className="flex flex-col items-end gap-1">
      {translating ? (
        <span className="text-xs italic text-gray-500 dark:text-gray-400">
          {t('translating')}
        </span>
      ) : (
        <button
          type="button"
          onClick={toggle}
          className="cursor-pointer rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900"
        >
          {isTranslated ? t('showOriginal') : t('translateButton')}
        </button>
      )}

      {isTranslated && (
        <p className="text-right text-xs italic text-gray-500 dark:text-gray-400">
          {t('translatedDisclaimer')}
        </p>
      )}

      {error && (
        <p className="text-right text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
