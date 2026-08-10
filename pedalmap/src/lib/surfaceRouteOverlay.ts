import type { Feature, FeatureCollection, LineString } from 'geojson'
import type { RouteGeometry } from '@/domain/types'
import type { ValhallaEdgeAttr } from '@/lib/valhallaSurfaces'

export type SurfaceKind = 'paved' | 'unpaved' | 'unknown'

export interface SurfaceSegmentMeta {
  kind: SurfaceKind
  label: string
  distanceMeters: number
}

const SURFACE_KIND: Record<string, { kind: SurfaceKind; label: string }> = {
  paved_smooth: { kind: 'paved', label: 'Asfalto liso' },
  paved: { kind: 'paved', label: 'Pavimentado' },
  paved_rough: { kind: 'paved', label: 'Pavimento irregular' },
  compacted: { kind: 'unpaved', label: 'Grava compacta' },
  gravel: { kind: 'unpaved', label: 'Grava' },
  dirt: { kind: 'unpaved', label: 'Tierra' },
  path: { kind: 'unpaved', label: 'Sendero' },
  impassable: { kind: 'unpaved', label: 'Intransitable' },
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function sliceLineByDistance(
  coords: [number, number][],
  fromM: number,
  toM: number,
): [number, number][] {
  if (coords.length < 2 || toM <= fromM) return []
  const out: [number, number][] = []
  let acc = 0
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1]
    const b = coords[i]
    const seg = haversineMeters(a, b)
    const start = acc
    const end = acc + seg
    if (end >= fromM && start <= toM) {
      const t0 = seg > 0 ? Math.max(0, Math.min(1, (fromM - start) / seg)) : 0
      const t1 = seg > 0 ? Math.max(0, Math.min(1, (toM - start) / seg)) : 1
      const p0: [number, number] = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0]
      const p1: [number, number] = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]
      if (!out.length) out.push(p0)
      else {
        const last = out[out.length - 1]
        if (last[0] !== p0[0] || last[1] !== p0[1]) out.push(p0)
      }
      out.push(p1)
    }
    acc = end
    if (acc >= toM) break
  }
  return out
}

function classifyEdge(edge: ValhallaEdgeAttr): { kind: SurfaceKind; label: string } {
  const key = (edge.surface || '').toLowerCase()
  return SURFACE_KIND[key] ?? { kind: 'unknown', label: key || 'Sin clasificar' }
}

/**
 * Paint the full route geometry using Valhalla edge lengths as a proportional
 * surface timeline (edges come from map-matched samples, not shape indices).
 */
export function buildSurfaceRouteOverlay(
  geometry: RouteGeometry | null | undefined,
  edges: ValhallaEdgeAttr[] | null | undefined,
): FeatureCollection<LineString> {
  const empty: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] }
  const coords = geometry?.coordinates
  if (!coords || coords.length < 2) return empty

  let totalGeom = 0
  for (let i = 1; i < coords.length; i += 1) {
    totalGeom += haversineMeters(coords[i - 1], coords[i])
  }
  if (totalGeom <= 0) return empty

  const usable = (edges ?? []).filter((e) => (e.length ?? 0) > 0)
  if (!usable.length) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kind: 'unknown', label: 'Sin clasificar' },
          geometry: { type: 'LineString', coordinates: coords },
        },
      ],
    }
  }

  const edgeTotalM = usable.reduce((s, e) => s + (e.length ?? 0) * 1000, 0) || 1
  const features: Feature<LineString>[] = []
  let cursor = 0

  for (const edge of usable) {
    const edgeM = (edge.length ?? 0) * 1000
    const span = (edgeM / edgeTotalM) * totalGeom
    const from = cursor
    const to = Math.min(totalGeom, cursor + span)
    cursor = to
    const slice = sliceLineByDistance(coords, from, to)
    if (slice.length < 2) continue
    const { kind, label } = classifyEdge(edge)
    features.push({
      type: 'Feature',
      properties: { kind, label, distanceMeters: Math.round(to - from) },
      geometry: { type: 'LineString', coordinates: slice },
    })
  }

  if (cursor < totalGeom - 5) {
    const slice = sliceLineByDistance(coords, cursor, totalGeom)
    if (slice.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { kind: 'unknown', label: 'Sin clasificar', distanceMeters: Math.round(totalGeom - cursor) },
        geometry: { type: 'LineString', coordinates: slice },
      })
    }
  }

  return { type: 'FeatureCollection', features }
}

export function summarizeUnpavedAlert(
  bikeType: string,
  unpavedPercent: number | undefined,
  unpavedMetersHint?: number,
): string | null {
  const pct = unpavedPercent ?? 0
  if (bikeType === 'road' && pct >= 8) {
    const km =
      unpavedMetersHint && unpavedMetersHint > 0
        ? `${(unpavedMetersHint / 1000).toFixed(1)} km`
        : `${Math.round(pct)}%`
    return `Cuidado: ~${km} sin asfaltar. En carretera puede haber tramos duros.`
  }
  if ((bikeType === 'urban' || bikeType === 'ebike') && pct >= 15) {
    return `Hay ~${Math.round(pct)}% de tierra/grava. Valora gravel o MTB si quieres más comodidad.`
  }
  if (bikeType === 'mtb' && pct < 5 && (unpavedPercent ?? 0) >= 0) {
    // mostly paved — soft tip only when almost all paved
    if (pct <= 3) return `Ruta muy pavimentada para MTB — perfecto si buscas enlace rápido.`
  }
  return null
}
