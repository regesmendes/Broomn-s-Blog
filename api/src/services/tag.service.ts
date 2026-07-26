import { tagRepository } from '../repositories/tag.repository'
import { slugify } from '../lib/slugify'
import { ListAdminTagsQuery } from '../schemas/tag.schema'

// ─── Service ───────────────────────────────────────────────────────────────────

export const tagService = {
  async list() {
    const tags = await tagRepository.findAllWithCount()
    return tags.map(flattenCount)
  },

  /** Paginated, search-filterable listing for the admin tag management page. */
  async listAdmin(query: ListAdminTagsQuery) {
    const { cursor, limit, search } = query
    const { data, meta } = await tagRepository.findPaginatedWithCount({ cursor, limit, search })
    return { data: data.map(flattenCount), meta }
  },

  /**
   * Rename a tag. If the new name's slug already belongs to a different tag,
   * merge into it instead of renaming (reassigns this tag's posts onto the
   * existing one and deletes this tag) — the common real case is fixing a
   * typo'd tag into one that already exists under the correct spelling.
   */
  async rename(id: string, name: string) {
    const tag = await tagRepository.findById(id)
    if (!tag) return null

    const slug = slugify(name)
    const conflict = await tagRepository.findBySlugExcluding(slug, id)

    const result = conflict
      ? await tagRepository.mergeInto(id, conflict.id)
      : await tagRepository.update(id, { name, slug })

    return result ? flattenCount(result) : null
  },

  async remove(id: string) {
    const tag = await tagRepository.findByIdWithCount(id)
    if (!tag) return null

    await tagRepository.delete(id)
    return flattenCount(tag)
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function flattenCount(tag: { id: string; name: string; slug: string; _count: { posts: number } }) {
  const { _count, ...rest } = tag
  return { ...rest, postCount: _count.posts }
}
