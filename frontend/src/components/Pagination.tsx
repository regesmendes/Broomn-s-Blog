'use client';

import { useTranslations } from 'next-intl';

interface PaginationProps {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function Pagination({ hasPrevious, hasNext, onPrevious, onNext }: PaginationProps) {
  const t = useTranslations('home');

  if (!hasPrevious && !hasNext) return null;

  return (
    <div className="mt-8 flex items-center justify-center gap-4">
      <button
        onClick={onPrevious}
        disabled={!hasPrevious}
        className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {t('previousPage')}
      </button>

      <button
        onClick={onNext}
        disabled={!hasNext}
        className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {t('nextPage')}
      </button>
    </div>
  );
}
