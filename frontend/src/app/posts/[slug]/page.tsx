import { notFound } from 'next/navigation';
import Link from 'next/link';
import api, { ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post;
  try {
    post = await api.getPost(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImage}
          alt={post.title}
          className="mb-8 w-full rounded-lg object-cover"
        />
      )}

      <header className="mb-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900">{post.title}</h1>

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
      </header>

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <div className="mt-12 border-t border-gray-200 pt-8">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          &larr; Back to all posts
        </Link>
      </div>
    </article>
  );
}
