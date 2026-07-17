'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import api, { TagWithCount } from '@/lib/api';

interface SearchAndFilterProps {
  onFilter: (params: { tag?: string; search?: string }) => void;
  activeTag?: string;
  activeSearch?: string;
}

export function SearchAndFilter({ onFilter, activeTag, activeSearch }: SearchAndFilterProps) {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [search, setSearch] = useState(activeSearch || '');
  const t = useTranslations('home');

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    try {
      const data = await api.getTags();
      setTags(data);
    } catch {
      // silently fail
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    onFilter({ tag: activeTag, search: search.trim() || undefined });
  }

  function handleTagClick(slug: string) {
    const newTag = activeTag === slug ? undefined : slug;
    onFilter({ tag: newTag, search: search.trim() || undefined });
  }

  function handleClear() {
    setSearch('');
    onFilter({});
  }

  const hasFilters = activeTag || activeSearch;

  return (
    <div className="mb-8 space-y-4">
      {/* Search input */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {t('searchButton')}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t('clearFilters')}
          </button>
        )}
      </form>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleTagClick(tag.slug)}
              className={`cursor-pointer rounded-full px-3 py-1 text-sm transition ${
                activeTag === tag.slug
                  ? 'bg-emerald-700 text-white dark:bg-emerald-600'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-800'
              }`}
            >
              {tag.name}
              <span className="ml-1 opacity-60">({tag.postCount})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
