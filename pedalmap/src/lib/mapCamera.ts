import type { RouteGeometry } from '@/domain/types'

/**
 * Stable-ish camera identity for a LineString: length + endpoints + midpoint.
 * Used as MapView `fitKey` so GPX imports / new geometries pan the map once.
 */
export function routeCameraKey(
  geometry: RouteGeometry | null | undefined,
  extra?: string | number | null,
): string {
  const coords = geometry?.coordinates
  if (!coords?.length) return `empty${extra != null && extra !== '' ? `-${extra}` : ''}`
  const start = coords[0]
  const mid = coords[Math.floor(coords.length / 2)]
  const end = coords[coords.length - 1]
  const parts = [
    String(coords.length),
    start[0].toFixed(5),
    start[1].toFixed(5),
    mid[0].toFixed(5),
    mid[1].toFixed(5),
    end[0].toFixed(5),
    end[1].toFixed(5),
  ]
  if (extra != null && extra !== '') parts.push(String(extra))
  return parts.join(':')
}
