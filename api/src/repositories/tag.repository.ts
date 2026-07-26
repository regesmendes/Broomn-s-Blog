import { prisma } from '../lib/prisma'
import { paginateWithCursor } from '../lib/pagination'

const tagWithCountSelect = {
  id:   true,
  name: true,
  slug: true,
  _count: {
    select: { posts: true },
  },
} as const

export const tagRepository = {
  async findAllWithCount() {
    return prisma.tag.findMany({
      select:  tagWithCountSelect,
      orderBy: { name: 'asc' },
    })
  },

  /** Paginated, optionally search-filtered tag listing — powers the admin tag management page. */
  async findPaginatedWithCount({
    cursor,
    limit,
    search,
  }: {
    cursor?: string
    limit:   number
    search?: string
  }) {
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {}

    return paginateWithCursor(
      (args) =>
        prisma.tag.findMany({
          where,
          select:  tagWithCountSelect,
          // name is itself @unique, but id is added for consistency with the
          // rest of the codebase's "always end orderBy in a unique tiebreaker" rule.
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          ...args,
        }),
      { cursor, limit }
    )
  },

  async findById(id: string) {
    return prisma.tag.findUnique({ where: { id } })
  },

  async findByIdWithCount(id: string) {
    return prisma.tag.findUnique({ where: { id }, select: tagWithCountSelect })
  },

  /** Find a different tag already using this slug, if any — used to detect a rename-into-merge. */
  async findBySlugExcluding(slug: string, excludeId: string) {
    return prisma.tag.findFirst({ where: { slug, NOT: { id: excludeId } } })
  },

  async update(id: string, data: { name: string; slug: string }) {
    return prisma.tag.update({ where: { id }, data, select: tagWithCountSelect })
  },

  async delete(id: string) {
    return prisma.tag.delete({ where: { id } })
  },

  /**
   * Reassign every post linked to sourceId onto targetId, then delete the
   * source tag. Posts already linked to both are left as-is on the target
   * (skipped, not duplicated — TagsOnPosts' composite PK would reject a dupe
   * anyway). Deleting the source tag cascades away its now-superfluous
   * TagsOnPosts rows.
   */
  async mergeInto(sourceId: string, targetId: string) {
    const [sourceLinks, targetLinks] = await Promise.all([
      prisma.tagsOnPosts.findMany({ where: { tagId: sourceId }, select: { postId: true } }),
      prisma.tagsOnPosts.findMany({ where: { tagId: targetId }, select: { postId: true } }),
    ])

    const targetPostIds = new Set(targetLinks.map((link) => link.postId))
    const newLinks = sourceLinks
      .filter((link) => !targetPostIds.has(link.postId))
      .map((link) => ({ postId: link.postId, tagId: targetId }))

    await prisma.$transaction([
      ...(newLinks.length ? [prisma.tagsOnPosts.createMany({ data: newLinks })] : []),
      prisma.tag.delete({ where: { id: sourceId } }),
    ])

    return prisma.tag.findUnique({ where: { id: targetId }, select: tagWithCountSelect })
  },
}
