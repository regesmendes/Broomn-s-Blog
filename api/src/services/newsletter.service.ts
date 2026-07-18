import { createHmac } from 'crypto'
import { newsletterRepository } from '../repositories/newsletter.repository'
import { ListSubscribersQuery } from '../schemas/newsletter.schema'
import { SubscriptionStatus } from '@prisma/client'
import { sendEmail } from '../lib/ses'

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

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:3000'
}

// ─── Email templates (PT-first, matches the blog's default language) ───────────

function confirmationEmail(confirmUrl: string) {
  return {
    subject: 'Confirme sua assinatura — Blog do Broomn',
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h1 style="font-size: 22px;">Blog do Broomn</h1>
        <p>Olá! Recebemos um pedido de assinatura da newsletter com este e-mail.</p>
        <p>Clique no link abaixo para confirmar:</p>
        <p><a href="${confirmUrl}" style="color: #1d4ed8;">Confirmar assinatura</a></p>
        <p style="color: #6b7280; font-size: 13px;">Se você não pediu essa assinatura, pode ignorar este e-mail.</p>
      </div>
    `,
    text: `Blog do Broomn\n\nRecebemos um pedido de assinatura da newsletter com este e-mail.\n\nConfirme em: ${confirmUrl}\n\nSe você não pediu essa assinatura, pode ignorar este e-mail.`,
  }
}

function newsletterEmail(subject: string, content: string, unsubscribeUrl: string) {
  return {
    subject,
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        ${content}
        <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 13px;">
          Você está recebendo este e-mail porque assina a newsletter do Blog do Broomn.
          <a href="${unsubscribeUrl}" style="color: #1d4ed8;">Cancelar assinatura</a>
        </p>
      </div>
    `,
    text: `${content}\n\n---\nCancelar assinatura: ${unsubscribeUrl}`,
  }
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const newsletterService = {
  /**
   * Subscribe an email. Sends a confirmation email via SES with a link
   * containing an HMAC token (verifiable without a DB lookup).
   */
  async subscribe(email: string, userId?: string) {
    const subscriber = await newsletterRepository.subscribe(email, userId)
    const confirmToken = generateToken(subscriber.id)
    const confirmUrl = `${getFrontendUrl()}/pt/newsletter/confirm?token=${confirmToken}`

    try {
      await sendEmail({ to: subscriber.email, ...confirmationEmail(confirmUrl) })
    } catch (err) {
      // Don't fail the subscription if the email provider hiccups — the row is
      // already created and an admin can be alerted separately if this matters.
      console.error('Failed to send newsletter confirmation email:', err)
    }

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

  /** Send a newsletter to all confirmed subscribers, each with their own unsubscribe link. */
  async send(subject: string, content: string) {
    const subscribers = await newsletterRepository.getConfirmedSubscribers()

    if (subscribers.length === 0) {
      return { sent: 0, recipients: [] }
    }

    let sent = 0
    for (const subscriber of subscribers) {
      const unsubscribeToken = generateToken(subscriber.id)
      const unsubscribeUrl = `${getFrontendUrl()}/pt/newsletter/unsubscribe?token=${unsubscribeToken}`

      try {
        await sendEmail({
          to: subscriber.email,
          ...newsletterEmail(subject, content, unsubscribeUrl),
        })
        sent++
      } catch (err) {
        console.error(`Failed to send newsletter to ${subscriber.email}:`, err)
      }
    }

    return { sent, recipients: subscribers.map((s) => s.email) }
  },
}
