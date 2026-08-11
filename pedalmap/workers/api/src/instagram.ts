import type { Env } from './types'
import { json } from './types'

const GRAPH = 'https://graph.facebook.com/v21.0'

export type InstagramPublishInput = {
  imageUrl: string
  caption: string
}

function requireOpsAuth(request: Request, env: Env): Response | null {
  const expected = (env.INSTAGRAM_OPS_TOKEN || '').trim()
  if (!expected) return json({ error: 'INSTAGRAM_OPS_TOKEN not configured' }, 503)
  const got = request.headers.get('X-PedalMap-Ops-Token') || ''
  if (got !== expected) return json({ error: 'Unauthorized' }, 401)
  return null
}

async function graphJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init)
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok || data.error) {
    const err = data.error as { message?: string } | undefined
    throw new Error(err?.message || `Instagram Graph error ${res.status}`)
  }
  return data
}

/** Create container → wait briefly → publish. Image URL must be publicly reachable by Meta. */
export async function publishInstagramPhoto(
  env: Env,
  input: InstagramPublishInput,
): Promise<{ id: string; containerId: string }> {
  const igUserId = (env.INSTAGRAM_IG_USER_ID || '').trim()
  const token = (env.INSTAGRAM_ACCESS_TOKEN || '').trim()
  if (!igUserId || !token) {
    throw new Error('Missing INSTAGRAM_IG_USER_ID or INSTAGRAM_ACCESS_TOKEN')
  }

  const createUrl = new URL(`${GRAPH}/${igUserId}/media`)
  createUrl.searchParams.set('image_url', input.imageUrl)
  createUrl.searchParams.set('caption', input.caption)
  createUrl.searchParams.set('access_token', token)

  const created = await graphJson(createUrl.toString(), { method: 'POST' })
  const containerId = String(created.id || '')
  if (!containerId) throw new Error('No container id from Instagram')

  // Meta needs a moment to fetch/process the image.
  for (let i = 0; i < 8; i++) {
    const statusUrl = new URL(`${GRAPH}/${containerId}`)
    statusUrl.searchParams.set('fields', 'status_code')
    statusUrl.searchParams.set('access_token', token)
    const status = await graphJson(statusUrl.toString())
    const code = String(status.status_code || '')
    if (code === 'FINISHED') break
    if (code === 'ERROR') throw new Error('Instagram media container ERROR')
    await new Promise((r) => setTimeout(r, 2000))
  }

  const publishUrl = new URL(`${GRAPH}/${igUserId}/media_publish`)
  publishUrl.searchParams.set('creation_id', containerId)
  publishUrl.searchParams.set('access_token', token)
  const published = await graphJson(publishUrl.toString(), { method: 'POST' })
  const id = String(published.id || '')
  if (!id) throw new Error('No media id after publish')
  return { id, containerId }
}

export async function handleInstagramPublish(request: Request, env: Env): Promise<Response> {
  const denied = requireOpsAuth(request, env)
  if (denied) return denied
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405)

  let body: Partial<InstagramPublishInput>
  try {
    body = (await request.json()) as Partial<InstagramPublishInput>
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const imageUrl = (body.imageUrl || '').trim()
  const caption = (body.caption || '').trim()
  if (!imageUrl || !caption) {
    return json({ error: 'imageUrl and caption required' }, 400)
  }
  if (!/^https:\/\//i.test(imageUrl)) {
    return json({ error: 'imageUrl must be https' }, 400)
  }

  try {
    const result = await publishInstagramPhoto(env, { imageUrl, caption })
    return json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed'
    console.error('[instagram]', message)
    return json({ error: message }, 502)
  }
}

export async function handleInstagramStatus(request: Request, env: Env): Promise<Response> {
  const denied = requireOpsAuth(request, env)
  if (denied) return denied
  return json({
    configured: Boolean(env.INSTAGRAM_IG_USER_ID && env.INSTAGRAM_ACCESS_TOKEN),
    igUserIdSet: Boolean(env.INSTAGRAM_IG_USER_ID),
    tokenSet: Boolean(env.INSTAGRAM_ACCESS_TOKEN),
  })
}
