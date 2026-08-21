import type { RouteGeometry } from '@/domain/types'
import type { WaterPoint } from '@/domain/routeEnricher'
import { buildWaterPointsAlongRoute } from '@/domain/routeEnrichmentBuilder'
import { routingAuthHeaders } from '@/lib/routingAuth'

export interface RawWaterSource {
  id: string
  lat: number
  lon: number
  name: string | null
  type: string
  address?: string | null
  access?: string | null
  drinkingWater?: string | null
  description?: string | null
  website?: string | null
  phone?: string | null
}

export interface WaterEnrichmentResult {
  recommendedWaterPoints: WaterPoint[]
  allWaterPoints: WaterPoint[]
  degraded: boolean
  reason?: string
}

const API_URL = import.meta.env.VITE_PEDALMAP_API_URL?.replace(/\/+$/, '') || ''
const WATER_SOURCES_PATH = '/osm/water-sources'

export class WaterSourceService {
  private cache: Map<string, { data: RawWaterSource[]; ts: number }> = new Map()
  private readonly TTL = 24 * 60 * 60 * 1000

  async fetchForRoute(geometry: RouteGeometry): Promise<WaterEnrichmentResult> {
    if (!geometry.coordinates.length) {
      return { recommendedWaterPoints: [], allWaterPoints: [], degraded: false }
    }

    const bbox = computeBbox(geometry.coordinates)
    const cacheKey = `${bbox.s.toFixed(3)},${bbox.w.toFixed(3)},${bbox.n.toFixed(3)},${bbox.e.toFixed(3)}`

    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < this.TTL) {
      const { recommended, all } = buildWaterPointsAlongRoute({
        geometry,
        sources: cached.data.map((s) => ({
          id: s.id,
          position: { lat: s.lat, lng: s.lon },
          name: s.name ?? undefined,
          address: s.address,
          access: s.access,
          drinkingWater: s.drinkingWater,
          description: s.description,
          website: s.website,
          phone: s.phone,
        })),
      })
      return { recommendedWaterPoints: recommended, allWaterPoints: all, degraded: false }
    }

    if (!API_URL) {
      return { recommendedWaterPoints: [], allWaterPoints: [], degraded: true, reason: 'no_api_url' }
    }

    try {
      const headers = await routingAuthHeaders({ Accept: 'application/json' })
      const res = await fetch(
        `${API_URL}${WATER_SOURCES_PATH}?bbox=${bbox.s},${bbox.w},${bbox.n},${bbox.e}`,
        { headers },
      )

      if (!res.ok) {
        return { recommendedWaterPoints: [], allWaterPoints: [], degraded: true, reason: `upstream_${res.status}` }
      }

      const json = (await res.json()) as {
        sources?: RawWaterSource[]
        degraded?: boolean
        reason?: string
      }

      const sources = Array.isArray(json.sources) ? json.sources : []
      if (sources.length > 0) {
        this.cache.set(cacheKey, { data: sources, ts: Date.now() })
      }

      const { recommended, all } = buildWaterPointsAlongRoute({
        geometry,
        sources: sources.map((s) => ({
          id: s.id,
          position: { lat: s.lat, lng: s.lon },
          name: s.name ?? undefined,
          address: s.address,
          access: s.access,
          drinkingWater: s.drinkingWater,
          description: s.description,
          website: s.website,
          phone: s.phone,
        })),
      })

      return {
        recommendedWaterPoints: recommended,
        allWaterPoints: all,
        degraded: Boolean(json.degraded),
        reason: json.reason,
      }
    } catch {
      return { recommendedWaterPoints: [], allWaterPoints: [], degraded: true, reason: 'network_error' }
    }
  }
}

function computeBbox(
  coords: [number, number][],
): { s: number; w: number; n: number; e: number } {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const [lng, lat] of coords) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  const pad = 0.01
  return { s: minLat - pad, w: minLng - pad, n: maxLat + pad, e: maxLng + pad }
}

export const waterSourceService = new WaterSourceService()
