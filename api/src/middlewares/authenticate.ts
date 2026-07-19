import { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch (_err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}
