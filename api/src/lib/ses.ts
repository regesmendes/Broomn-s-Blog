import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

const sesClient = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' })

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const fromEmail = process.env.SES_FROM_EMAIL ?? 'noreply@blogdobroomn.com'

  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail,
      Destination: { ToAddresses: [params.to] },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: params.html, Charset: 'UTF-8' },
            Text: { Data: params.text, Charset: 'UTF-8' },
          },
        },
      },
    }),
  )
}
