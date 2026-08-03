import { prisma } from '../lib/prisma'

// ─── Repository ────────────────────────────────────────────────────────────────
// AboutPage is a singleton — exactly one row, seeded by migration. There is
// no create/delete; only find the one row and update its content.

export const aboutRepository = {
  async find() {
    return prisma.aboutPage.findFirst()
  },

  async updateContent(id: string, content: string, contentEn?: string | null) {
    return prisma.aboutPage.update({
      where: { id },
      data: { content, contentEn },
    })
  },
}
