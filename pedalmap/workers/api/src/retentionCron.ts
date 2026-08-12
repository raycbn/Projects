/**
 * Daily retention / trial nudges + wind-watch email reminders.
 * Soft: requires RESEND_API_KEY; otherwise logs and exits cleanly.
 */
import type { Env } from './types'
import { sendMail } from './mail'

type FirestoreDoc = {
  name?: string
  fields?: Record<string, unknown>
}

function strField(fields: Record<string, unknown> | undefined, key: string): string | null {
  const v = fields?.[key] as { stringValue?: string } | undefined
  return v?.stringValue ?? null
}

function boolField(fields: Record<string, unknown> | undefined, key: string): boolean {
  const v = fields?.[key] as { booleanValue?: boolean } | undefined
  return Boolean(v?.booleanValue)
}

function mapField(
  fields: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  const v = fields?.[key] as { mapValue?: { fields?: Record<string, unknown> } } | undefined
  return v?.mapValue?.fields
}

async function getAccessToken(sa: {
  client_email: string
  private_key: string
  token_uri?: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const b64 = (data: ArrayBuffer | string) => {
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const pem = sa.private_key
  const raw = atob(
    pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s+/g, ''),
  )
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) buf[i] = raw.charCodeAt(i)
  const unsigned = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claim))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    buf.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${b64(signature)}`
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  })
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as { access_token?: string }
  if (!res.ok || !json.access_token) throw new Error('token failed')
  return json.access_token
}

async function runQuery(
  projectId: string,
  token: string,
  structuredQuery: Record<string, unknown>,
): Promise<FirestoreDoc[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  })
  if (!res.ok) {
    console.warn('[retention] query failed', res.status, await res.text())
    return []
  }
  const rows = (await res.json()) as Array<{ document?: FirestoreDoc }>
  return rows.map((r) => r.document).filter((d): d is FirestoreDoc => Boolean(d?.name))
}

function daysBetween(iso: string, now = new Date()): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return -1
  return Math.floor((now.getTime() - t) / 86_400_000)
}

/**
 * Email users who signed up ~2 days ago and have not created a route yet.
 * Also reminds wind-watch users to check Mis rutas (in-app is primary; this is a nudge).
 */
export async function runRetentionNudges(env: Env): Promise<{
  trialSent: number
  windNudges: number
  skipped: string
}> {
  if (!env.RESEND_API_KEY?.trim()) {
    return { trialSent: 0, windNudges: 0, skipped: 'resend_not_configured' }
  }
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    return { trialSent: 0, windNudges: 0, skipped: 'no_service_account' }
  }

  let sa: { client_email: string; private_key: string; project_id?: string; token_uri?: string }
  try {
    sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  } catch {
    return { trialSent: 0, windNudges: 0, skipped: 'bad_service_account' }
  }

  const projectId = sa.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(sa)
  const appUrl = (env.APP_URL || 'https://pedalmap.es').replace(/\/+$/, '')
  let trialSent = 0
  let windNudges = 0

  // Recent users (limit 40) — filter day-2 locally.
  const users = await runQuery(projectId, token, {
    from: [{ collectionId: 'users' }],
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
    limit: 40,
  })

  for (const doc of users) {
    const fields = doc.fields
    const email = strField(fields, 'email')
    if (!email || !email.includes('@')) continue
    const createdAt =
      (fields?.createdAt as { timestampValue?: string; stringValue?: string } | undefined)
        ?.timestampValue ||
      strField(fields, 'createdAt') ||
      ''
    const age = daysBetween(createdAt)
    if (age !== 2) continue

    const usage = mapField(fields, 'usage')
    const created =
      Number(
        (usage?.routesCreatedThisMonth as { integerValue?: string; doubleValue?: number } | undefined)
          ?.integerValue ??
          (usage?.routesCreatedThisMonth as { doubleValue?: number } | undefined)?.doubleValue ??
          0,
      ) || 0
    const mailMeta = mapField(fields, 'mailMeta')
    if (boolField(mailMeta, 'day2NudgeSent')) continue
    if (created > 0) continue

    const result = await sendMail(env, {
      to: email,
      subject: 'PedalMap · tu primera ruta en 5 minutos',
      text: [
        'Hola,',
        '',
        'Creaste PedalMap hace un par de días. ¿Todavía no has trazado tu primera salida?',
        '',
        `Abre el planificador: ${appUrl}/route-planner`,
        'Elige inicio y destino (o Objetivo circular), mira desnivel y viento, y guarda o exporta GPX.',
        '',
        '— PedalMap',
      ].join('\n'),
      from: env.MAIL_FROM || 'PedalMap <aviso@pedalmap.es>',
    })
    if (result.sent) {
      trialSent += 1
      const uid = doc.name?.split('/').pop()
      if (uid) {
        const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=mailMeta`
        await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              mailMeta: {
                mapValue: {
                  fields: {
                    day2NudgeSent: { booleanValue: true },
                    day2NudgeAt: { timestampValue: new Date().toISOString() },
                  },
                },
              },
            },
          }),
        }).catch(() => undefined)
      }
    }
  }

  // Soft wind-watch reminder: users with email alerts on (cap 15).
  const alertUsers = await runQuery(projectId, token, {
    from: [{ collectionId: 'users' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'notifications.windAlertsEmail' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    },
    limit: 15,
  })

  for (const doc of alertUsers) {
    const email = strField(doc.fields, 'email')
    if (!email) continue
    const mailMeta = mapField(doc.fields, 'mailMeta')
    const last = strField(mailMeta, 'windNudgeDay')
    const today = new Date().toISOString().slice(0, 10)
    if (last === today) continue

    const result = await sendMail(env, {
      to: email,
      subject: 'PedalMap · revisa tus avisos de viento',
      text: [
        'Hola,',
        '',
        'Tienes avisos de viento activos. Abre Mis rutas para ver si hay una ventana excelente hoy:',
        `${appUrl}/my-routes`,
        '',
        'Puedes desactivar el email en Perfil.',
        '',
        '— PedalMap',
      ].join('\n'),
      from: env.MAIL_FROM || 'PedalMap <aviso@pedalmap.es>',
    })
    if (result.sent) {
      windNudges += 1
      const uid = doc.name?.split('/').pop()
      if (uid) {
        const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=mailMeta`
        await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              mailMeta: {
                mapValue: {
                  fields: {
                    ...(mailMeta || {}),
                    windNudgeDay: { stringValue: today },
                  },
                },
              },
            },
          }),
        }).catch(() => undefined)
      }
    }
  }

  void 0
  return { trialSent, windNudges, skipped: 'ok' }
}
