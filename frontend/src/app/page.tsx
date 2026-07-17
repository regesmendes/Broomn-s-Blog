import Link from 'next/link';
import { Metadata } from 'next';
import api from '@/lib/api';
import { Post } from '@/lib/api';
import { HeroSection } from '@/components/HeroSection';
import { Divider } from '@/components/Divider';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Broomn's Blog",
  description: 'Chronicles from Broomn, the druid storyteller. A place for stories worth sharing around the fire.',
  openGraph: {
    title: "Broomn's Blog",
    description: 'Chronicles from Broomn, the druid storyteller. A place for stories worth sharing around the fire.',
    type: 'website',
  },
};

export default async function HomePage() {
  let posts: Post[] = [];
  let error = false;

  try {
    const result = await api.getPosts();
    posts = result.data;
  } catch {
    error = true;
  }

  return (
    <>
      <HeroSection />
      <Divider />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">Latest Posts</h2>

      {error && (
        <p className="text-gray-500 dark:text-gray-400">Unable to load posts. Please try again later.</p>
      )}

      {!error && posts.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">No posts yet. Check back soon!</p>
      )}

      <div className="grid gap-8">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <Link href={`/posts/${post.slug}`}>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400">
                {post.title}
              </h2>
            </Link>

            {post.excerpt && (
              <p className="mb-4 text-gray-600 dark:text-gray-400">{post.excerpt}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-500">
              {post.publishedAt && (
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              )}

              {post.tags.length > 0 && (
                <div className="flex gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      </div>
    </>
  );
}
