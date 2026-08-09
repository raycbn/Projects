import type { ElevationPoint, LatLng, RouteDraft, RouteGeometry } from '@/domain/types'
import { buildStatsFromProfile, pathDistanceMeters } from '@/lib/stats'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function exportRouteToGpx(route: Pick<RouteDraft, 'title' | 'description' | 'geometry' | 'elevationProfile'>): string {
  const elevByIndex = route.elevationProfile
  const points = route.geometry.coordinates.map(([lng, lat], index) => {
    const elev = elevByIndex[index]?.elevationMeters
    const eleTag = elev !== undefined ? `<ele>${elev.toFixed(1)}</ele>` : ''
    return `<trkpt lat="${lat}" lon="${lng}">${eleTag}</trkpt>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BikeRoute" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(route.title)}</name>
    ${route.description ? `<desc>${escapeXml(route.description)}</desc>` : ''}
  </metadata>
  <trk>
    <name>${escapeXml(route.title)}</name>
    <trkseg>
      ${points.join('\n      ')}
    </trkseg>
  </trk>
</gpx>
`
}

export interface ImportedGpx {
  name: string
  description?: string
  points: Array<LatLng & { elevationMeters?: number; time?: string }>
  geometry: RouteGeometry
  elevationProfile: ElevationPoint[]
  distanceMeters: number
}

function parseTrackPoints(doc: Document): ImportedGpx['points'] {
  const nodes = [
    ...doc.querySelectorAll('trkpt'),
    ...doc.querySelectorAll('rtept'),
  ]
  return nodes.map((node) => {
    const lat = Number(node.getAttribute('lat'))
    const lng = Number(node.getAttribute('lon'))
    const ele = node.querySelector('ele')?.textContent
    const time = node.querySelector('time')?.textContent ?? undefined
    return {
      lat,
      lng,
      elevationMeters: ele !== undefined && ele !== null && ele !== '' ? Number(ele) : undefined,
      time,
    }
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
}

export function parseGpx(xml: string): ImportedGpx {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('GPX inválido')
  }

  const points = parseTrackPoints(doc)
  if (points.length < 2) {
    throw new Error('El GPX no contiene suficientes puntos')
  }

  const name =
    doc.querySelector('trk > name')?.textContent?.trim() ||
    doc.querySelector('metadata > name')?.textContent?.trim() ||
    'Ruta importada'
  const description =
    doc.querySelector('trk > desc')?.textContent?.trim() ||
    doc.querySelector('metadata > desc')?.textContent?.trim() ||
    undefined

  const geometry: RouteGeometry = {
    type: 'LineString',
    coordinates: points.map((p) => [p.lng, p.lat]),
  }

  let distance = 0
  const elevationProfile: ElevationPoint[] = []
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) {
      distance += pathDistanceMeters(
        [{ lat: points[i - 1].lat, lng: points[i - 1].lng }, { lat: points[i].lat, lng: points[i].lng }],
      )
    }
    elevationProfile.push({
      distanceMeters: distance,
      elevationMeters: points[i].elevationMeters ?? 0,
      position: { lat: points[i].lat, lng: points[i].lng },
    })
  }

  return {
    name,
    description,
    points,
    geometry,
    elevationProfile,
    distanceMeters: pathDistanceMeters(points.map((p) => ({ lat: p.lat, lng: p.lng }))),
  }
}

export function importedGpxToDraft(imported: ImportedGpx): RouteDraft {
  const stats = buildStatsFromProfile(
    imported.distanceMeters,
    imported.elevationProfile,
    'road',
  )
  return {
    title: imported.name,
    description: imported.description,
    type: 'a_to_b',
    bikeType: 'road',
    preferences: [],
    waypoints: [
      {
        id: 'start',
        name: 'Inicio',
        position: { lat: imported.points[0].lat, lng: imported.points[0].lng },
        order: 0,
        kind: 'start',
      },
      {
        id: 'end',
        name: 'Fin',
        position: {
          lat: imported.points[imported.points.length - 1].lat,
          lng: imported.points[imported.points.length - 1].lng,
        },
        order: 1,
        kind: 'end',
      },
    ],
    geometry: imported.geometry,
    elevationProfile: imported.elevationProfile,
    stats,
  }
}
