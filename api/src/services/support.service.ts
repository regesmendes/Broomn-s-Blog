import { supportRepository } from '../repositories/support.repository'
import { prisma } from '../lib/prisma'

export const supportService = {
  async get() {
    return supportRepository.find()
  },

  async update(content: string) {
    const existing = await supportRepository.find()
    if (!existing) return null

    const updated = await supportRepository.updateContent(existing.id, content)
    await syncMediaUsage(existing.id, content)
    return updated
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Scan the Support page's HTML content for media filenames and sync the
 * MediaOnSupportPage junction table — same approach as post.service.ts's
 * syncMediaUsage, kept separate rather than shared since the two junction
 * tables (and their id columns) differ.
 */
async function syncMediaUsage(supportPageId: string, content: string) {
  const filenameRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+/g
  const filenames = content.match(filenameRegex) || []

  if (filenames.length === 0) {
    await prisma.mediaOnSupportPage.deleteMany({ where: { supportPageId } })
    return
  }

  const mediaRecords = await prisma.media.findMany({
    where: { filename: { in: filenames } },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.mediaOnSupportPage.deleteMany({ where: { supportPageId } }),
    ...mediaRecords.map((m) =>
      prisma.mediaOnSupportPage.create({ data: { mediaId: m.id, supportPageId } })
    ),
  ])
}
