import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import api, { ApiError } from '@/lib/api';
import { CommentSection } from '@/components/CommentSection';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await api.getPost(slug);
    return {
      title: `${post.title} | Broomn's Blog`,
      description: post.excerpt || post.content.replace(/<[^>]*>/g, '').slice(0, 160),
      openGraph: {
        title: post.title,
        description: post.excerpt || post.content.replace(/<[^>]*>/g, '').slice(0, 160),
        type: 'article',
        publishedTime: post.publishedAt || undefined,
        ...(post.coverImage && { images: [{ url: post.coverImage }] }),
      },
      twitter: {
        card: post.coverImage ? 'summary_large_image' : 'summary',
        title: post.title,
        description: post.excerpt || post.content.replace(/<[^>]*>/g, '').slice(0, 160),
        ...(post.coverImage && { images: [post.coverImage] }),
      },
    };
  } catch {
    return { title: "Post not found | Broomn's Blog" };
  }
}

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
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
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
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
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

      {/* Comments */}
      <CommentSection postId={post.id} />

      <div className="mt-8 border-t border-gray-200 pt-8 dark:border-gray-700">
        <Link href="/" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          &larr; Back to all posts
        </Link>
      </div>
    </article>
  );
}
