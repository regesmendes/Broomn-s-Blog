import { prisma } from '../lib/prisma'

// ─── Repository ────────────────────────────────────────────────────────────────
// SupportPage is a singleton — exactly one row, seeded by migration. There is
// no create/delete; only find the one row and update its content.

export const supportRepository = {
  async find() {
    return prisma.supportPage.findFirst()
  },

  async updateContent(id: string, content: string) {
    return prisma.supportPage.update({
      where: { id },
      data: { content },
    })
  },
}
