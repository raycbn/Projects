import type { Env } from './types'
import { json } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import { publishPublicRouteShare, type PublishShareInput } from './firestore'

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function sanitizePayload(body: unknown): PublishShareInput {
  if (!isRecord(body)) throw new Error('invalid_body')
  const title = String(body.title || 'Ruta').slice(0, 120)
  const geometry = body.geometry
  const waypoints = body.waypoints
  const stats = body.stats
  if (!isRecord(geometry) || !Array.isArray(waypoints) || !isRecord(stats)) {
    throw new Error('missing_route_fields')
  }
  const coords = (geometry as { coordinates?: unknown }).coordinates
  if (!Array.isArray(coords) || coords.length < 2) throw new Error('invalid_geometry')

  const instructions = Array.isArray(body.instructions)
    ? body.instructions.filter((s): s is string => typeof s === 'string').slice(0, 80)
    : undefined

  return {
    title,
    description: body.description ? String(body.description).slice(0, 500) : undefined,
    type: String(body.type || 'a_to_b'),
    bikeType: String(body.bikeType || 'road'),
    preferences: Array.isArray(body.preferences) ? body.preferences : [],
    waypoints,
    geometry,
    elevationProfile: Array.isArray(body.elevationProfile) ? body.elevationProfile : [],
    stats: stats as Record<string, unknown>,
    circularDistanceMeters:
      typeof body.circularDistanceMeters === 'number' ? body.circularDistanceMeters : undefined,
    shareSlug: body.shareSlug ? String(body.shareSlug).slice(0, 80) : undefined,
    routeId: body.routeId ? String(body.routeId).slice(0, 128) : undefined,
    instructions,
  }
}

/** POST /routes/publish — Admin write of a public shareable route. */
export async function handlePublishRoute(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json(
      {
        error: 'Inicia sesión con una cuenta real para compartir.',
        code: 'auth_required',
      },
      401,
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json({ error: 'JSON inválido', code: 'invalid_json' }, 400)
  }

  let input: PublishShareInput
  try {
    input = sanitizePayload(raw)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_body'
    return json({ error: 'Ruta incompleta para publicar', code }, 400)
  }

  try {
    const published = await publishPublicRouteShare(env, identity.uid, input)
    return json({
      ok: true,
      routeId: published.routeId,
      shareSlug: published.shareSlug,
      path: `/route/${published.shareSlug}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'publish_failed'
    if (message === 'save_limit') {
      return json(
        {
          error: 'Has alcanzado el límite de rutas guardadas del plan Free.',
          code: 'save_limit',
        },
        403,
      )
    }
    if (message === 'route_forbidden') {
      return json(
        {
          error: 'No puedes publicar una ruta que no es tuya.',
          code: 'route_forbidden',
        },
        403,
      )
    }
    if (message === 'route_not_found') {
      return json({ error: 'La ruta no existe.', code: 'route_not_found' }, 404)
    }
    console.error('[publish-route]', message)
    return json({ error: message, code: 'publish_failed' }, 500)
  }
}
