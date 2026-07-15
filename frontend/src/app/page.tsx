import Link from 'next/link';
import api from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { data: posts } = await api.getPosts();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Latest Posts</h1>

      {posts.length === 0 && (
        <p className="text-gray-500">No posts yet. Check back soon!</p>
      )}

      <div className="grid gap-8">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <Link href={`/posts/${post.slug}`}>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 hover:text-blue-600">
                {post.title}
              </h2>
            </Link>

            {post.excerpt && (
              <p className="mb-4 text-gray-600">{post.excerpt}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {post.publishedAt && (
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('pt-BR', {
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
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
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
  );
}
