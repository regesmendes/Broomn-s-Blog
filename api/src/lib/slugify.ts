/**
 * Shared slug generator for tags. Post-save tag upserts (post.repository.ts)
 * and the tag-rename/merge endpoints (tag.repository.ts) must produce
 * identical slugs for the same input — otherwise a renamed tag could fail to
 * collide with a tag the exact same name would upsert into on the next post
 * save, defeating merge-on-rename.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '') // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
