import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Post } from '@/lib/api';

interface PostCardProps {
  post: Post;
  dateLocale: string;
}

export function PostCard({ post, dateLocale }: PostCardProps) {
  const locale = useLocale();
  const t = useTranslations('home');
  const isPtFallback = locale === 'en' && !post.titleEn;
  const title = locale === 'en' ? (post.titleEn ?? post.title) : post.title;
  const excerpt = locale === 'en' ? (post.excerptEn ?? post.excerpt) : post.excerpt;

  return (
    <article className="flex gap-4 overflow-hidden rounded-lg bg-white shadow-sm transition hover:shadow-md dark:bg-gray-800">
      {post.coverImage && (
        <Link href={`/posts/${post.slug}`} className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage}
            alt={post.title}
            className="h-full w-32 object-cover sm:w-40"
          />
        </Link>
      )}

      <div className={`min-w-0 flex-1 ${post.coverImage ? 'py-4 pr-4' : 'p-4'}`}>
        {/* Color/hover/visited live on the anchor itself, not the heading —
            :visited can only restyle the link element it matches, never a
            descendant, so an h2-level color class would silently never
            apply once the link had been visited. */}
        <Link
          href={`/posts/${post.slug}`}
          className="text-emerald-800 hover:text-emerald-600 visited:text-emerald-800 dark:text-emerald-200 dark:hover:text-emerald-400 dark:visited:text-emerald-200"
        >
          <h2 className="mb-2 text-xl font-semibold">{title}</h2>
        </Link>

        {excerpt && <p className="mb-4 text-gray-600 dark:text-gray-400">{excerpt}</p>}

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-500">
          {post.publishedAt && (
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString(dateLocale, {
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

          {isPtFallback && (
            <span className="text-xs italic text-amber-600 dark:text-amber-400">
              {t('translationUnavailable')}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
