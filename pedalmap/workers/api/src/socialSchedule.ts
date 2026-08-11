import type { Env } from './types'
import { json } from './types'
import { publishInstagramPhoto } from './instagram'
import {
  SOCIAL_CAMPAIGN_DEFAULT_START,
  SOCIAL_CAMPAIGN_DAYS,
  buildSocialCalendar,
  campaignDayIndex,
  postForCampaignDay,
  type SocialPost,
} from './socialCalendar'

type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri?: string
}

function requireOpsAuth(request: Request, env: Env): Response | null {
  const expected = (env.INSTAGRAM_OPS_TOKEN || '').trim()
  if (!expected) return json({ error: 'INSTAGRAM_OPS_TOKEN not configured' }, 503)
  const got = request.headers.get('X-PedalMap-Ops-Token') || ''
  if (got !== expected) return json({ error: 'Unauthorized' }, 401)
  return null
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) buf[i] = raw.charCodeAt(i)
  return buf.buffer
}

function base64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64url(signature)}`
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  })
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(`Service account token failed: ${data.error || res.status}`)
  }
  return data.access_token
}

function parseSa(env: Env): ServiceAccount | null {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null
  try {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount
  } catch {
    return null
  }
}

async function readLastPublishedDay(env: Env): Promise<number | null> {
  const sa = parseSa(env)
  if (!sa) return null
  const token = await getAccessToken(sa)
  const projectId = env.FIREBASE_PROJECT_ID
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ops/instagramCampaign`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (!res.ok) return null
  const doc = (await res.json()) as {
    fields?: { lastPublishedDay?: { integerValue?: string } }
  }
  const raw = doc.fields?.lastPublishedDay?.integerValue
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

async function writeLastPublished(
  env: Env,
  day: number,
  mediaId: string,
  post: SocialPost,
): Promise<void> {
  const sa = parseSa(env)
  if (!sa) return
  const token = await getAccessToken(sa)
  const projectId = env.FIREBASE_PROJECT_ID
  const now = new Date().toISOString()
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ops/instagramCampaign?updateMask.fieldPaths=lastPublishedDay&updateMask.fieldPaths=lastMediaId&updateMask.fieldPaths=lastTheme&updateMask.fieldPaths=lastPath&updateMask.fieldPaths=updatedAt`
  await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        lastPublishedDay: { integerValue: String(day) },
        lastMediaId: { stringValue: mediaId },
        lastTheme: { stringValue: post.theme },
        lastPath: { stringValue: post.path },
        updatedAt: { timestampValue: now },
      },
    }),
  })
}

function campaignStart(env: Env): string {
  return (env.SOCIAL_CAMPAIGN_START || SOCIAL_CAMPAIGN_DEFAULT_START).trim() || SOCIAL_CAMPAIGN_DEFAULT_START
}

export type ScheduleRunResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  day?: number
  date?: string
  theme?: string
  mediaId?: string
  dryRun?: boolean
}

/** Cron / ops: publish today's campaign post once (idempotent via Firestore). */
export async function runScheduledSocialPost(
  env: Env,
  opts: { forceDay?: number; dryRun?: boolean; now?: Date } = {},
): Promise<ScheduleRunResult> {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_IG_USER_ID) {
    return { ok: false, skipped: true, reason: 'Instagram secrets not configured' }
  }

  const start = campaignStart(env)
  const now = opts.now ?? new Date()
  const dayIndex = opts.forceDay != null ? opts.forceDay - 1 : campaignDayIndex(now, start)
  const post = postForCampaignDay(dayIndex, start)
  if (!post) {
    return {
      ok: true,
      skipped: true,
      reason:
        dayIndex < 0
          ? 'Campaign not started yet'
          : `Campaign finished (${SOCIAL_CAMPAIGN_DAYS} days)`,
      day: dayIndex + 1,
    }
  }

  const last = await readLastPublishedDay(env)
  if (last != null && last >= post.day && opts.forceDay == null) {
    return {
      ok: true,
      skipped: true,
      reason: `Already published day ${last}`,
      day: post.day,
      date: post.date,
      theme: post.theme,
    }
  }

  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      day: post.day,
      date: post.date,
      theme: post.theme,
    }
  }

  const published = await publishInstagramPhoto(env, {
    imageUrl: post.imageUrl,
    caption: post.caption,
  })
  await writeLastPublished(env, post.day, published.id, post)
  return {
    ok: true,
    day: post.day,
    date: post.date,
    theme: post.theme,
    mediaId: published.id,
  }
}

export async function handleInstagramScheduleStatus(request: Request, env: Env): Promise<Response> {
  const denied = requireOpsAuth(request, env)
  if (denied) return denied
  const start = campaignStart(env)
  const dayIndex = campaignDayIndex(new Date(), start)
  const today = postForCampaignDay(dayIndex, start)
  const last = await readLastPublishedDay(env)
  const upcoming = buildSocialCalendar(start).slice(
    Math.max(0, dayIndex),
    Math.max(0, dayIndex) + 7,
  )
  return json({
    startDate: start,
    totalDays: SOCIAL_CAMPAIGN_DAYS,
    todayIndex: dayIndex + 1,
    today,
    lastPublishedDay: last,
    instagramConfigured: Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_IG_USER_ID),
    upcoming,
    publicCalendar: `${(env.APP_URL || 'https://pedalmap.es').replace(/\/+$/, '')}/social/calendar-90d.json`,
  })
}

export async function handleInstagramScheduleRun(request: Request, env: Env): Promise<Response> {
  const denied = requireOpsAuth(request, env)
  if (denied) return denied
  let body: { forceDay?: number; dryRun?: boolean } = {}
  if (request.method === 'POST') {
    try {
      body = (await request.json()) as { forceDay?: number; dryRun?: boolean }
    } catch {
      body = {}
    }
  }
  try {
    const result = await runScheduledSocialPost(env, body)
    return json(result, result.ok ? 200 : 503)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Schedule run failed'
    console.error('[social-schedule]', message)
    return json({ ok: false, error: message }, 502)
  }
}
