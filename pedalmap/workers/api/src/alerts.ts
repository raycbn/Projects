import type { Env } from './types'
import { json, resolveAppUrl } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import { sendMail } from './mail'
import { readUserFollowNotifyTarget } from './firestore'

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

type FollowAlertBody = {
  followeeId?: string
  followerDisplayName?: string
}

function pwaInstallSteps(appUrl: string): string {
  return [
    `Para recibir avisos al instante en el móvil (como una app):`,
    ``,
    `1) Abre ${appUrl} en el navegador (Safari en iPhone, Chrome en Android).`,
    `2) iPhone (Safari): toca Compartir → «Añadir a pantalla de inicio».`,
    `3) Android (Chrome): menú ⋮ → «Instalar app» o «Añadir a la pantalla de inicio».`,
    `4) Abre PedalMap desde el icono, inicia sesión y acepta notificaciones en Perfil.`,
    ``,
    `Así te llegarán los «te siguen» aunque no tengas el correo a mano.`,
  ].join('\n')
}

/**
 * Notify followee that someone followed them (email + soft PWA guidance).
 * Soft-fails without RESEND / missing email so follow UX never breaks.
 */
export async function handleFollowAlertEmail(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json({ error: 'Se requiere una cuenta real' }, 401)
  }

  const body = (await request.json().catch(() => ({}))) as FollowAlertBody
  const followeeId = String(body.followeeId || '').trim()
  if (!followeeId || followeeId === identity.uid) {
    return json({ error: 'followeeId inválido' }, 400)
  }

  const followerName = String(body.followerDisplayName || 'Un ciclista').slice(0, 80)
  const appUrl = resolveAppUrl(env, request)
  const target = await readUserFollowNotifyTarget(env, followeeId)
  if (!target) {
    return json({ ok: true, sent: false, reason: 'service_account_missing', push: false })
  }

  if (!target.followAlertsEmail) {
    return json({ ok: true, sent: false, reason: 'opted_out', push: false })
  }

  const to = target.email?.trim()
  if (!to) {
    return json({ ok: true, sent: false, reason: 'no_followee_email', push: false })
  }

  const hasPwaPush = target.followAlertsPush && target.hasPushSubscription
  const subject = `PedalMap · ${followerName} te sigue`
  const text = [
    `Hola${target.displayName ? ` ${target.displayName}` : ''},`,
    ``,
    `${followerName} ha empezado a seguirte en PedalMap.`,
    `Mira tu comunidad: ${appUrl}/explorar`,
    ``,
    hasPwaPush
      ? `También puedes ver el aviso en la app PedalMap (PWA) si la tienes instalada.`
      : pwaInstallSteps(appUrl),
    ``,
    `— PedalMap`,
    `Puedes desactivar estos correos en Perfil → Avisos de comunidad.`,
  ].join('\n')

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
    push: hasPwaPush,
    pwaHint: !hasPwaPush,
  })
}

type RouteSavedBody = {
  routeTitle?: string
  shareSlug?: string
  distanceMeters?: number
  elevationGainMeters?: number
}

/** Soft email after saving/publishing a route — never blocks the product path. */
export async function handleRouteSavedEmail(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json({ error: 'Se requiere una cuenta real' }, 401)
  }
  const to = identity.email?.trim()
  if (!to) {
    return json({ ok: true, sent: false, reason: 'no_email' })
  }

  const body = (await request.json().catch(() => ({}))) as RouteSavedBody
  const title = String(body.routeTitle || 'Tu ruta').slice(0, 120)
  const appUrl = resolveAppUrl(env, request)
  const link = body.shareSlug
    ? `${appUrl}/route/${encodeURIComponent(body.shareSlug)}`
    : `${appUrl}/my-routes`
  const dist =
    typeof body.distanceMeters === 'number'
      ? `${(body.distanceMeters / 1000).toFixed(1)} km`
      : null
  const elev =
    typeof body.elevationGainMeters === 'number'
      ? `+${Math.round(body.elevationGainMeters)} m`
      : null
  const stats = [dist, elev].filter(Boolean).join(' · ')

  const subject = `PedalMap · ruta lista: ${title}`
  const text = [
    `Hola,`,
    ``,
    `Tu ruta «${title}» ya está guardada${stats ? ` (${stats})` : ''}.`,
    `Ábrela: ${link}`,
    ``,
    `Siguiente paso: exporta GPX, mira el viento o compártela con la grupeta.`,
    `Crear otra gratis: ${appUrl}/route-planner`,
    ``,
    `— PedalMap · Hecho en España`,
  ].join('\n')

  const result = await sendMail(env, {
    to,
    subject,
    text,
    from: env.MAIL_FROM || 'PedalMap <aviso@pedalmap.es>',
  })

  return json({ ok: true, sent: result.sent, reason: result.reason, id: result.id })
}
