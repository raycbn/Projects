import type { RoutingProvider } from '@/adapters/routing/RoutingProvider'
import { OpenRouteServiceProvider } from '@/adapters/routing/OpenRouteServiceProvider'
import { ValhallaProvider } from '@/adapters/routing/ValhallaProvider'
import type { LatLng, RoutingRequest, RoutingResult } from '@/domain/types'
import { RoutingError } from '@/domain/types'

type Alt = NonNullable<RoutingResult['alternatives']>[number]

function approxMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const φ1 = toRad(a.lat)
  const φ2 = toRad(b.lat)
  const Δφ = toRad(b.lat - a.lat)
  const Δλ = toRad(b.lng - a.lng)
  const s =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)))
}

function offsetLatLng(origin: LatLng, bearingDeg: number, distanceMeters: number): LatLng {
  const R = 6371000
  const δ = distanceMeters / R
  const θ = (bearingDeg * Math.PI) / 180
  const φ1 = (origin.lat * Math.PI) / 180
  const λ1 = (origin.lng * Math.PI) / 180
  const sinφ1 = Math.sin(φ1)
  const cosφ1 = Math.cos(φ1)
  const sinδ = Math.sin(δ)
  const cosδ = Math.cos(δ)
  const φ2 = Math.asin(sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ))
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * Math.sin(φ2))
  return { lat: (φ2 * 180) / Math.PI, lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180 }
}

function midPoint(coords: [number, number][]): LatLng | null {
  if (coords.length < 2) return null
  const mid = coords[Math.floor(coords.length / 2)]!
  return { lng: mid[0], lat: mid[1] }
}

function routesDistinct(a: Alt, b: Alt): boolean {
  const da = a.stats.distanceMeters
  const db = b.stats.distanceMeters
  const denom = Math.max(da, db, 1)
  if (Math.abs(da - db) / denom > 0.05) return true
  const ma = midPoint(a.geometry.coordinates)
  const mb = midPoint(b.geometry.coordinates)
  if (!ma || !mb) return true
  return approxMeters(ma, mb) > 500
}

function mergeAlts(primary: RoutingResult, extras: Alt[], maxAlts = 2): Alt[] {
  const out: Alt[] = []
  const primaryAsAlt: Alt = {
    geometry: primary.geometry,
    elevationProfile: primary.elevationProfile,
    stats: primary.stats,
    rawInstructions: primary.rawInstructions,
    surfaceEdges: primary.surfaceEdges,
  }
  for (const cand of [...(primary.alternatives ?? []), ...extras]) {
    if ((cand.geometry.coordinates?.length ?? 0) < 2) continue
    if (!routesDistinct(primaryAsAlt, cand)) continue
    if (out.some((kept) => !routesDistinct(kept, cand))) continue
    out.push(cand)
    if (out.length >= maxAlts) break
  }
  return out
}

/**
 * Valhalla-first for A→B, ida-vuelta and Objetivo.
 * ORS + via-detours top up so /ruta usually gets 2–3 opciones even when the
 * Worker collapses native alternates (or is under CPU pressure).
 */
export class CompositeRoutingProvider implements RoutingProvider {
  readonly name = 'composite-valhalla-ors'
  private readonly valhalla: ValhallaProvider
  private readonly ors: OpenRouteServiceProvider

  constructor(
    valhalla: ValhallaProvider = new ValhallaProvider(),
    ors: OpenRouteServiceProvider = new OpenRouteServiceProvider(),
  ) {
    this.valhalla = valhalla
    this.ors = ors
  }

  isConfigured(): boolean {
    return this.valhalla.isConfigured() || this.ors.isConfigured()
  }

  async calculateRoute(request: RoutingRequest): Promise<RoutingResult> {
    if (!this.isConfigured()) {
      throw new RoutingError(
        'No routing provider configured (Valhalla proxy and/or ORS)',
        'not_configured',
      )
    }

    if (this.valhalla.isConfigured()) {
      try {
        let result = await this.valhalla.calculateRoute(request)
        if (request.wantAlternatives && request.routeType !== 'circular') {
          result = await this.ensureAlternatives(request, result)
        }
        return result
      } catch (error) {
        console.warn('[routing] Valhalla failed; falling back to ORS', error)
        // Cheap primary retry without alternatives, then top up vias client-side.
        if (request.wantAlternatives && request.routeType !== 'circular') {
          try {
            const primary = await this.valhalla.calculateRoute({
              ...request,
              wantAlternatives: false,
            })
            return await this.ensureAlternatives(request, primary)
          } catch (retryErr) {
            console.warn('[routing] Valhalla primary retry failed', retryErr)
          }
        }
        if (!this.ors.isConfigured()) throw error
      }
    }

    if (!this.ors.isConfigured()) {
      throw new RoutingError('ORS fallback is not configured', 'not_configured')
    }

    return this.ors.calculateRoute({
      ...request,
      wantAlternatives: Boolean(request.wantAlternatives),
      circularSeed: request.circularSeed ?? 0,
    })
  }

  /** Top up with ORS + cheap via-detours until we have up to 2 alternatives. */
  private async ensureAlternatives(
    request: RoutingRequest,
    result: RoutingResult,
  ): Promise<RoutingResult> {
    let alts = [...(result.alternatives ?? [])]
    if (alts.length >= 2) return result

    if (this.ors.isConfigured()) {
      try {
        const ors = await this.ors.calculateRoute({
          ...request,
          wantAlternatives: true,
        })
        alts = mergeAlts(result, [
          {
            geometry: ors.geometry,
            elevationProfile: ors.elevationProfile,
            stats: ors.stats,
            rawInstructions: ors.rawInstructions,
            surfaceEdges: ors.surfaceEdges,
          },
          ...(ors.alternatives ?? []),
        ])
      } catch (orsErr) {
        console.warn('[routing] ORS alternatives top-up failed', orsErr)
      }
    }

    if (alts.length < 2 && this.valhalla.isConfigured() && request.waypoints.length >= 2) {
      const detours = await this.fetchViaDetours(request, result)
      alts = mergeAlts(result, [...alts, ...detours])
    }

    return { ...result, alternatives: alts.length ? alts.slice(0, 2) : undefined }
  }

  private async fetchViaDetours(
    request: RoutingRequest,
    primary: RoutingResult,
  ): Promise<Alt[]> {
    const start = request.waypoints[0]
    const end = request.waypoints[request.waypoints.length - 1]
    if (!start || !end) return []
    const span = approxMeters(start, end)
    const offsetM = Math.max(800, Math.min(4200, span * 0.2))
    const bearing =
      (Math.atan2(end.lng - start.lng, end.lat - start.lat) * 180) / Math.PI
    const mid = {
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2,
    }
    const vias = [
      offsetLatLng(mid, bearing - 90, offsetM),
      offsetLatLng(mid, bearing + 90, offsetM),
    ]

    const out: Alt[] = []
    for (const via of vias) {
      if (out.length + (primary.alternatives?.length ?? 0) >= 2) break
      try {
        const detour = await this.valhalla.calculateRoute({
          ...request,
          wantAlternatives: false,
          waypoints: [start, via, end],
        })
        out.push({
          geometry: detour.geometry,
          elevationProfile: detour.elevationProfile,
          stats: detour.stats,
          rawInstructions: detour.rawInstructions,
          surfaceEdges: detour.surfaceEdges,
        })
      } catch (err) {
        console.warn('[routing] via-detour failed', err)
      }
    }
    return out
  }
}
