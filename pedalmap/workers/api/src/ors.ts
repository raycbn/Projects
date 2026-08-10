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
  let upstream: Response
  try {
    upstream = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
        Authorization: env.ORS_API_KEY,
      },
      body,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ORS upstream unreachable'
    return json(
      {
        error: 'ORS network error',
        message,
        profile,
        maintenance: false,
      },
      502,
    )
  }

  const text = await upstream.text()
  const contentType = upstream.headers.get('Content-Type') || ''
  const looksHtml = contentType.includes('text/html') || text.trimStart().startsWith('<!')
  const maintenance =
    upstream.status === 503 || text.toLowerCase().includes('down for maintenance')

  // Normalize HeiGIT HTML maintenance pages so the SPA always gets JSON.
  if (maintenance || (looksHtml && upstream.status >= 500)) {
    return json(
      {
        error: 'OpenRouteService temporarily unavailable',
        maintenance: true,
        profile,
        status: upstream.status,
      },
      503,
    )
  }

  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType.includes('json') ? contentType : 'application/json',
    },
  })
}
