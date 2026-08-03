import { supportRepository } from '../repositories/support.repository'
import { prisma } from '../lib/prisma'

export const supportService = {
  async get() {
    return supportRepository.find()
  },

  async update(content: string, contentEn?: string) {
    const existing = await supportRepository.find()
    if (!existing) return null

    const normalizedContentEn = contentEn === undefined ? undefined : isBlankHtml(contentEn) ? null : contentEn
    // Not provided at all -> untouched, so still scan whatever's already
    // persisted; explicitly cleared (null) must not fall back to the stale
    // pre-clear value here.
    const contentEnForSync = normalizedContentEn === undefined ? existing.contentEn : normalizedContentEn

    const updated = await supportRepository.updateContent(existing.id, content, normalizedContentEn)
    await syncMediaUsage(existing.id, content, contentEnForSync)
    return updated
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * True when HTML has no real text content. Tiptap serializes an empty
 * document as "<p></p>", which a naive `!value` check would miss.
 */
function isBlankHtml(value: string): boolean {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length === 0
}

/**
 * Scan the Support page's HTML content (both languages) for media filenames
 * and sync the MediaOnSupportPage junction table — same approach as
 * post.service.ts's syncMediaUsage, kept separate rather than shared since
 * the two junction tables (and their id columns) differ.
 */
async function syncMediaUsage(supportPageId: string, content: string, contentEn?: string | null) {
  const filenameRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+/g
  const combined = content + '\n' + (contentEn ?? '')
  const filenames = combined.match(filenameRegex) || []

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
