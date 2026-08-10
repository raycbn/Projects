import type { Env } from './types'
import { ORS_BASE, json } from './types'

const PROFILE_RE = /^cycling-(regular|road|mountain|electric)$/

export async function handleOrsProxy(request: Request, env: Env, path: string): Promise<Response> {
  if (!env.ORS_API_KEY) {
    return json({ error: 'ORS_API_KEY not configured on worker' }, 500)
  }

  const match = path.match(/\/v2\/directions\/(cycling-(?:regular|road|mountain|electric))\/geojson\/?$/)
  const profile = match?.[1]
  if (!profile || !PROFILE_RE.test(profile)) {
    return json(
      {
        error: 'Invalid cycling profile',
        hint: 'POST /v2/directions/{cycling-*}/geojson',
      },
      400,
    )
  }

  const body = await request.text()
  const upstream = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, application/geo+json',
      Authorization: env.ORS_API_KEY,
    },
    body,
  })

  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
    },
  })
}
