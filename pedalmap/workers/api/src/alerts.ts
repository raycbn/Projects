import type { Env } from './types'
import { json, resolveAppUrl } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import { sendMail } from './mail'

type WindAlertBody = {
  routeId?: string
  routeTitle?: string
  caption?: string
  score?: number
  startHour?: string
  endHour?: string
}

/**
 * Opt-in wind alert email. Stubbed until RESEND_API_KEY is set.
 * From: aviso@pedalmap.es (or MAIL_FROM / noreply@).
 */
export async function handleWindAlertEmail(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json({ error: 'Se requiere una cuenta real' }, 401)
  }
  const to = identity.email?.trim()
  if (!to) {
    return json({ error: 'La cuenta no tiene email' }, 400)
  }

  const body = (await request.json().catch(() => ({}))) as WindAlertBody
  const title = String(body.routeTitle || 'Tu ruta').slice(0, 120)
  const caption = String(body.caption || '').slice(0, 200)
  const score = typeof body.score === 'number' ? Math.round(body.score) : null
  const appUrl = resolveAppUrl(env, request)
  const routePath = body.routeId ? `${appUrl}/ruta?routeId=${encodeURIComponent(body.routeId)}` : appUrl

  const scoreBit = score != null ? ` (${score}/100)` : ''
  const subject = `PedalMap · mejor ventana para ${title}`
  const text = [
    `Hola,`,
    ``,
    `Hay una ventana excelente para «${title}»${scoreBit}.`,
    caption ? `Cuándo: ${caption}` : null,
    ``,
    `Abrir ruta: ${routePath}`,
    ``,
    `— PedalMap`,
    `Puedes desactivar avisos en Perfil.`,
  ]
    .filter((line) => line != null)
    .join('\n')

  const result = await sendMail(env, {
    to,
    subject,
    text,
    from: env.MAIL_FROM || 'PedalMap <aviso@pedalmap.es>',
  })

  return json({
    ok: true,
    sent: result.sent,
    reason: result.reason,
    id: result.id,
  })
}
