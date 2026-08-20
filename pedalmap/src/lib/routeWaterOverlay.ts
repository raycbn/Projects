import type { Feature, FeatureCollection, Point } from 'geojson'
import type { RouteGeometry } from '@/domain/types'
import type { WaterPoint } from '@/domain/routeEnricher'

export interface RouteWaterOverlayOptions {
  maxVisible?: number
}

/**
 * Build map overlay: discrete Point markers for water sources along the route.
 * Returns a GeoJSON FeatureCollection of Points.
 */
export function buildRouteWaterOverlay(
  geometry: RouteGeometry,
  waterPoints: WaterPoint[],
  opts: RouteWaterOverlayOptions = {},
): FeatureCollection {
  const coords = geometry.coordinates as [number, number][]
  if (!coords.length || !waterPoints?.length) {
    return { type: 'FeatureCollection', features: [] }
  }

  const maxVisible = opts.maxVisible ?? 10
  const sorted = waterPoints
    .filter((p) => typeof p.distanceAlongRouteMeters === 'number' && Number.isFinite(p.distanceAlongRouteMeters))
    .sort((a, b) => a.distanceAlongRouteMeters! - b.distanceAlongRouteMeters!)
    .slice(0, maxVisible)

  const features: Feature<Point>[] = sorted.map((p, idx) => {
    const [lng, lat] = [p.position.lng, p.position.lat]
    return {
      type: 'Feature',
      properties: {
        kind: 'water_source',
        id: p.id,
        name: p.name ?? 'Fuente',
        order: idx + 1,
        distanceAlongRouteMeters: Math.round(p.distanceAlongRouteMeters!),
        detourMeters: Math.round(p.detourMeters ?? 0),
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    }
  })

  return { type: 'FeatureCollection', features }
}
