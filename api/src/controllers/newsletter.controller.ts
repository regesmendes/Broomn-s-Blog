import { FastifyRequest, FastifyReply } from 'fastify'
import { newsletterService } from '../services/newsletter.service'
import {
  subscribeSchema,
  confirmSchema,
  unsubscribeSchema,
  sendNewsletterSchema,
  listSubscribersQuerySchema,
} from '../schemas/newsletter.schema'

export const newsletterController = {
  // ── POST /newsletter/subscribe (public) ──────────────────────────────────────
  async subscribe(request: FastifyRequest, reply: FastifyReply) {
    const { email } = subscribeSchema.parse(request.body)
    const result = await newsletterService.subscribe(email)
    return reply.status(201).send({
      message: 'Subscription pending. Check your email to confirm.',
      subscriber: result.subscriber,
    })
  },

  // ── POST /newsletter/confirm (public — from email link) ──────────────────────
  async confirm(request: FastifyRequest, reply: FastifyReply) {
    const { token } = confirmSchema.parse(request.query)
    const subscriber = await newsletterService.confirm(token)

    if (!subscriber) {
      return reply.status(400).send({ error: 'Invalid or expired confirmation link' })
    }

    return reply.send({ message: 'Subscription confirmed!', subscriber })
  },

  // ── POST /newsletter/unsubscribe (public — from email link) ──────────────────
  async confirm_unsubscribe(request: FastifyRequest, reply: FastifyReply) {
    const { token } = unsubscribeSchema.parse(request.query)
    const subscriber = await newsletterService.unsubscribe(token)

    if (!subscriber) {
      return reply.status(400).send({ error: 'Invalid or expired unsubscribe link' })
    }

    return reply.send({ message: 'You have been unsubscribed.', subscriber })
  },

  // ── GET /newsletter/subscribers (admin) ──────────────────────────────────────
  async listSubscribers(request: FastifyRequest, reply: FastifyReply) {
    const query = listSubscribersQuerySchema.parse(request.query)
    const result = await newsletterService.list(query)
    return reply.send(result)
  },

  // ── POST /newsletter/send (admin) ────────────────────────────────────────────
  async send(request: FastifyRequest, reply: FastifyReply) {
    const { subject, content } = sendNewsletterSchema.parse(request.body)
    const result = await newsletterService.send(subject, content)

    if (result.sent === 0) {
      return reply.send({ message: 'No confirmed subscribers to send to.', sent: 0 })
    }

    return reply.send({
      message: `Newsletter sent to ${result.sent} subscriber(s).`,
      sent: result.sent,
    })
  },
}
