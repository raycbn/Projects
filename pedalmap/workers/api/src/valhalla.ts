import type { Env } from './types'
import { json } from './types'

const DEFAULT_VALHALLA = 'https://valhalla1.openstreetmap.de'
const USER_AGENT = 'PedalMap/1.0 (+https://pedalmap.es; bike routing)'

type ValhallaAction = 'route' | 'trace_attributes' | 'height'

function resolveUpstream(env: Env, action: ValhallaAction): { url: string; headers: HeadersInit } {
  if (env.STADIA_API_KEY) {
    // Stadia: route/trace use Valhalla paths; elevation is /elevation/v1 (not /height).
    const path =
      action === 'route'
        ? '/route/v1'
        : action === 'trace_attributes'
          ? '/trace_attributes/v1'
          : '/elevation/v1'
    return {
      url: `https://api.stadiamaps.com${path}?api_key=${encodeURIComponent(env.STADIA_API_KEY)}`,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  }

  const base = (env.VALHALLA_URL || DEFAULT_VALHALLA).replace(/\/+$/, '')
  return {
    url: `${base}/${action}`,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  }
}

export async function handleValhallaProxy(
  request: Request,
  env: Env,
  action: ValhallaAction,
): Promise<Response> {
  const body = await request.text()
  const upstream = resolveUpstream(env, action)

  let response: Response
  try {
    response = await fetch(upstream.url, {
      method: 'POST',
      headers: upstream.headers,
      body,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Valhalla unreachable'
    return json({ error: 'Valhalla network error', message }, 502)
  }

  const text = await response.text()
  return new Response(text, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  })
}
