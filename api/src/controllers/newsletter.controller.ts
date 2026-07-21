import { FastifyRequest, FastifyReply } from 'fastify'
import { newsletterService } from '../services/newsletter.service'
import {
  subscribeSchema,
  confirmSchema,
  unsubscribeSchema,
  sendNewsletterSchema,
  listSubscribersQuerySchema,
  subscriberIdParamSchema,
} from '../schemas/newsletter.schema'

export const newsletterController = {
  // ── POST /newsletter/subscribe (public) ──────────────────────────────────────
  async subscribe(request: FastifyRequest, reply: FastifyReply) {
    const { email } = subscribeSchema.parse(request.body)
    const result = await newsletterService.subscribe(email)

    if (result === 'blocked') {
      return reply.status(403).send({ error: 'This email address cannot subscribe.' })
    }

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

  // ── POST /newsletter/subscribers/:id/unsubscribe (admin) ─────────────────────
  async adminUnsubscribe(request: FastifyRequest, reply: FastifyReply) {
    const { id } = subscriberIdParamSchema.parse(request.params)
    const subscriber = await newsletterService.adminUnsubscribe(id)

    if (!subscriber) {
      return reply.status(404).send({ error: 'Subscriber not found' })
    }

    return reply.send(subscriber)
  },

  // ── PATCH /newsletter/subscribers/:id/block (admin) ──────────────────────────
  async block(request: FastifyRequest, reply: FastifyReply) {
    const { id } = subscriberIdParamSchema.parse(request.params)
    const subscriber = await newsletterService.block(id)

    if (!subscriber) {
      return reply.status(404).send({ error: 'Subscriber not found' })
    }

    return reply.send(subscriber)
  },

  // ── PATCH /newsletter/subscribers/:id/unblock (admin) ────────────────────────
  async unblock(request: FastifyRequest, reply: FastifyReply) {
    const { id } = subscriberIdParamSchema.parse(request.params)
    const subscriber = await newsletterService.unblock(id)

    if (!subscriber) {
      return reply.status(404).send({ error: 'Subscriber not found' })
    }

    return reply.send(subscriber)
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
