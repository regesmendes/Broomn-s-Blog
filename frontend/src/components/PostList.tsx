'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import api, { Post, PaginationMeta } from '@/lib/api';
import { SearchAndFilter } from '@/components/SearchAndFilter';
import { Pagination } from '@/components/Pagination';
import { TranslatablePostCard } from '@/components/TranslatablePostCard';

interface PostListProps {
  dateLocale: string;
}

export function PostList({ dateLocale }: PostListProps) {
  const t = useTranslations('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [tag, setTag] = useState<string | undefined>();
  const [search, setSearch] = useState<string | undefined>();

  useEffect(() => {
    loadPosts();
  }, [page, tag, search]);

  async function loadPosts() {
    setLoading(true);
    setError(false);
    try {
      const result = await api.getPosts({ page, limit: 10, tag, search });
      setPosts(result.data);
      setMeta(result.meta);
    } catch {
      setError(true);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFilter(params: { tag?: string; search?: string }) {
    setTag(params.tag);
    setSearch(params.search);
    setPage(1); // Reset to first page on new filter
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    // Scroll to top of post list
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">{t('latestPosts')}</h2>

      <SearchAndFilter
        onFilter={handleFilter}
        activeTag={tag}
        activeSearch={search}
      />

      {loading && (
        <p className="text-gray-500 dark:text-gray-400">...</p>
      )}

      {!loading && error && (
        <p className="text-gray-500 dark:text-gray-400">{t('loadError')}</p>
      )}

      {!loading && !error && posts.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">{t('noPosts')}</p>
      )}

      {!loading && !error && posts.length > 0 && (
        <>
          <div className="grid gap-8">
            {posts.map((post) => (
              <TranslatablePostCard
                key={post.id}
                post={post}
                dateLocale={dateLocale}
              />
            ))}
          </div>

          {meta && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
