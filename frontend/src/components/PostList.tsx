'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import api, { Post } from '@/lib/api';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { SearchAndFilter } from '@/components/SearchAndFilter';
import { Pagination } from '@/components/Pagination';
import { TranslatablePostCard } from '@/components/TranslatablePostCard';

interface PostListProps {
  dateLocale: string;
}

export function PostList({ dateLocale }: PostListProps) {
  const t = useTranslations('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tag, setTag] = useState<string | undefined>();
  const [search, setSearch] = useState<string | undefined>();
  const pagination = useCursorPagination();

  useEffect(() => {
    loadPosts();
  }, [pagination.cursor, tag, search]);

  async function loadPosts() {
    setLoading(true);
    setError(false);
    try {
      const result = await api.getPosts({ cursor: pagination.cursor, limit: 10, tag, search });
      setPosts(result.data);
      setHasMore(result.meta.hasMore);
      setNextCursor(result.meta.nextCursor);
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
    pagination.reset(); // Back to first page on new filter
  }

  function handleNext() {
    pagination.goNext(nextCursor);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }

  function handlePrevious() {
    pagination.goPrevious();
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

          <Pagination
            hasPrevious={pagination.hasPrevious}
            hasNext={hasMore}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        </>
      )}
    </div>
  );
}
