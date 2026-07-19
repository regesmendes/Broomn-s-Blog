import { aboutRepository } from '../repositories/about.repository'
import { prisma } from '../lib/prisma'

export const aboutService = {
  async get() {
    return aboutRepository.find()
  },

  async update(content: string) {
    const existing = await aboutRepository.find()
    if (!existing) return null

    const updated = await aboutRepository.updateContent(existing.id, content)
    await syncMediaUsage(existing.id, content)
    return updated
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Scan the About page's HTML content for media filenames and sync the
 * MediaOnAboutPage junction table — same approach as post.service.ts's
 * syncMediaUsage, kept separate rather than shared since the two junction
 * tables (and their id columns) differ.
 */
async function syncMediaUsage(aboutPageId: string, content: string) {
  const filenameRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+/g
  const filenames = content.match(filenameRegex) || []

  if (filenames.length === 0) {
    await prisma.mediaOnAboutPage.deleteMany({ where: { aboutPageId } })
    return
  }

  const mediaRecords = await prisma.media.findMany({
    where: { filename: { in: filenames } },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.mediaOnAboutPage.deleteMany({ where: { aboutPageId } }),
    ...mediaRecords.map((m) =>
      prisma.mediaOnAboutPage.create({ data: { mediaId: m.id, aboutPageId } })
    ),
  ])
}
