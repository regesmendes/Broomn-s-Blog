import { createHmac } from 'crypto'
import { newsletterRepository } from '../repositories/newsletter.repository'
import { ListSubscribersQuery } from '../schemas/newsletter.schema'
import { SubscriptionStatus } from '@prisma/client'

// ─── Token helpers ─────────────────────────────────────────────────────────────
// We generate HMAC tokens so we can verify them without storing anything.
// Token = base64(subscriberId + ":" + hmac(subscriberId))

function getSecret(): string {
  return process.env.JWT_SECRET ?? 'change-me-in-production'
}

function generateToken(subscriberId: string): string {
  const hmac = createHmac('sha256', getSecret()).update(subscriberId).digest('hex')
  return Buffer.from(`${subscriberId}:${hmac}`).toString('base64url')
}

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const [id, hmac] = decoded.split(':')
    const expected = createHmac('sha256', getSecret()).update(id).digest('hex')
    if (hmac === expected) return id
    return null
  } catch {
    return null
  }
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const newsletterService = {
  /**
   * Subscribe an email. Returns the subscriber record and a confirmation token.
   * In production, you'd send a confirmation email with a link containing the token.
   */
  async subscribe(email: string, userId?: string) {
    const subscriber = await newsletterRepository.subscribe(email, userId)
    const confirmToken = generateToken(subscriber.id)

    // TODO: send confirmation email via SES with link:
    // `${FRONTEND_URL}/newsletter/confirm?token=${confirmToken}`

    return { subscriber, confirmToken }
  },

  /** Confirm a subscription using the token from the email. */
  async confirm(token: string) {
    const id = verifyToken(token)
    if (!id) return null

    const subscriber = await newsletterRepository.findById(id)
    if (!subscriber) return null
    if (subscriber.status === 'CONFIRMED') return subscriber

    return newsletterRepository.confirm(id)
  },

  /** Unsubscribe using a token (included in every email footer). */
  async unsubscribe(token: string) {
    const id = verifyToken(token)
    if (!id) return null

    const subscriber = await newsletterRepository.findById(id)
    if (!subscriber) return null
    if (subscriber.status === 'UNSUBSCRIBED') return subscriber

    return newsletterRepository.unsubscribe(id)
  },

  /** List subscribers — admin view. */
  async list(query: ListSubscribersQuery) {
    const { page, limit, status } = query
    const { total, subscribers } = await newsletterRepository.listSubscribers(
      page,
      limit,
      status as SubscriptionStatus | undefined
    )

    return {
      data: subscribers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  },

  /**
   * Send a newsletter to all confirmed subscribers.
   * For now returns the list of recipients — SES integration comes with infra.
   */
  async send(subject: string, content: string) {
    const emails = await newsletterRepository.getConfirmedEmails()

    if (emails.length === 0) {
      return { sent: 0, recipients: [] }
    }

    // TODO: integrate with AWS SES
    // For each email, send via SES with an unsubscribe link in the footer.
    // The unsubscribe link should contain generateToken(subscriberId).

    return { sent: emails.length, recipients: emails }
  },
}
