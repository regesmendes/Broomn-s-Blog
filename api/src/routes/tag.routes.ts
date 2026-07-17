import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function tagRoutes(app: FastifyInstance) {
  // GET /tags — list all tags with post count
  app.get('/', async (request, reply) => {
    const tags = await prisma.tag.findMany({
      select: {
        id:   true,
        name: true,
        slug: true,
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const result = tags.map((tag) => ({
      id:        tag.id,
      name:      tag.name,
      slug:      tag.slug,
      postCount: tag._count.posts,
    }))

    return reply.send(result)
  })
}
