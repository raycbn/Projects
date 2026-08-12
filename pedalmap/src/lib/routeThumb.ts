/** Compact SVG polyline thumbnails for lists and profile covers. */

export type ThumbPoint = { lng: number; lat: number }

export function coordsFromGeometry(geometry: unknown): ThumbPoint[] {
  if (!geometry || typeof geometry !== 'object') return []
  const g = geometry as { type?: string; coordinates?: unknown }
  if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
    return g.coordinates
      .map((c) => {
        if (!Array.isArray(c) || c.length < 2) return null
        const lng = Number(c[0])
        const lat = Number(c[1])
        return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null
      })
      .filter((p): p is ThumbPoint => Boolean(p))
  }
  return []
}

export function coordsFromTrack(
  track: Array<{ position?: { lng?: number; lat?: number }; longitude?: number; latitude?: number }>,
): ThumbPoint[] {
  return track
    .map((p) => {
      const lng = Number(p.position?.lng ?? p.longitude)
      const lat = Number(p.position?.lat ?? p.latitude)
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null
    })
    .filter((p): p is ThumbPoint => Boolean(p))
}

export function downsamplePoints(points: ThumbPoint[], max = 48): ThumbPoint[] {
  if (points.length <= max) return points
  const out: ThumbPoint[] = []
  const step = (points.length - 1) / (max - 1)
  for (let i = 0; i < max; i += 1) {
    out.push(points[Math.round(i * step)]!)
  }
  return out
}

/** Project lng/lat to an SVG path inside a viewBox. */
export function pointsToSvgPath(
  points: ThumbPoint[],
  width = 120,
  height = 64,
  pad = 6,
): string | null {
  const pts = downsamplePoints(points, 56)
  if (pts.length < 2) return null
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const p of pts) {
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
  }
  const dx = Math.max(maxLng - minLng, 1e-6)
  const dy = Math.max(maxLat - minLat, 1e-6)
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const scale = Math.min(innerW / dx, innerH / dy)
  const ox = pad + (innerW - dx * scale) / 2
  const oy = pad + (innerH - dy * scale) / 2
  const parts = pts.map((p, i) => {
    const x = ox + (p.lng - minLng) * scale
    const y = oy + (maxLat - p.lat) * scale
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return parts.join(' ')
}
