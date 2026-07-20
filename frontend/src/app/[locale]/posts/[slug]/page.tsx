import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Metadata } from 'next';
import api, { ApiError } from '@/lib/api';
import { CommentSection } from '@/components/CommentSection';
import { PostContent } from '@/components/PostContent';
import { Divider } from '@/components/Divider';

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
      title: `${post.title} | Blog do Broomn`,
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
    return { title: "Post not found | Blog do Broomn" };
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;

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
          className="mb-8 w-full rounded-lg object-cover shadow-md"
        />
      )}

      <header className="mb-10 text-center">
        <h1 className="mb-4 text-4xl font-bold text-emerald-900 dark:text-emerald-100 md:text-5xl">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          {post.publishedAt && (
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', {
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
      </header>

      <Divider />

      <PostContent content={post.content} />

      {/* Comments */}
      <CommentSection postId={post.id} />

      <div className="mt-8 border-t border-emerald-200/50 pt-8 dark:border-emerald-900/50">
        <Link href="/" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300">
          &larr; Back to all posts
        </Link>
      </div>
    </article>
  );
}
