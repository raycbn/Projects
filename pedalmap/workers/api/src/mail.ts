import type { Env } from './types'

const DEFAULT_FROM = 'PedalMap <aviso@pedalmap.es>'

export type MailMessage = {
  to: string
  subject: string
  text: string
  html?: string
  /** Override From (default aviso@). */
  from?: string
}

/**
 * Soft mail helper. Sends via Resend when RESEND_API_KEY is set;
 * otherwise logs and returns sent:false so clients stay quiet.
 */
export async function sendMail(
  env: Env,
  message: MailMessage,
): Promise<{ sent: boolean; id?: string; reason?: string }> {
  const apiKey = env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.info('[mail] stub (no RESEND_API_KEY)', {
      to: message.to,
      subject: message.subject,
    })
    return { sent: false, reason: 'resend_not_configured' }
  }

  const from = message.from || env.MAIL_FROM || DEFAULT_FROM
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    id?: string
    message?: string
    name?: string
  }
  if (!res.ok) {
    console.warn('[mail] resend failed', res.status, data)
    return { sent: false, reason: data.message || data.name || `http_${res.status}` }
  }
  return { sent: true, id: data.id }
}
