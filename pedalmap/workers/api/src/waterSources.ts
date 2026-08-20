import type { Env } from './types'
import { json } from './types'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const OVERPASS_FALLBACK = 'https://overpass.kumi.systems/api/interpreter'
const USER_AGENT = 'PedalMap/1.0 (+https://pedalmap-79b3a.web.app; water sources)'

function buildQuery(bbox: [number, number, number, number]): string {
  const [s, w, n, e] = bbox
  return `[out:json][timeout:25];
(
  nwr["amenity"="drinking_water"](${s},${w},${n},${e});
  nwr["amenity"="water_point"](${s},${w},${n},${e});
  nwr["man_made"~"water_tap|water_well|drinking_fountain"](${s},${w},${n},${e});
  nwr["fountain"="drinking"](${s},${w},${n},${e});
  nwr["amenity"="fountain"]["drinking_water"="yes"](${s},${w},${n},${e});
  node["natural"="spring"](${s},${w},${n},${e});
);
out center;`
}

async function fetchOverpass(url: string, query: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'data=' + encodeURIComponent(query),
  })
}

export async function handleWaterSources(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url)
  const bboxParam = url.searchParams.get('bbox')
  if (!bboxParam) {
    return json({ error: 'bbox required' }, 400)
  }

  const parts = bboxParam.split(',').map(Number)
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) {
    return json({ error: 'invalid bbox' }, 400)
  }
  const [s, w, n, e] = parts as [number, number, number, number]

  const cacheKey = `water:${bboxParam}`
  const cached = await caches.default.match(cacheKey)
  if (cached) {
    return cached
  }

  const query = buildQuery([s, w, n, e])
  let res = await fetchOverpass(OVERPASS, query)
  if (!res.ok) {
    res = await fetchOverpass(OVERPASS_FALLBACK, query)
  }

  if (!res.ok) {
    const body = json({ sources: [], degraded: true, reason: 'upstream_unavailable' }, 200)
    await caches.default.put(cacheKey, body.clone())
    return body
  }

  const data = await res.json() as { elements?: Array<Record<string, unknown>> }
  const elements = Array.isArray(data?.elements) ? data.elements : []

  const sources = elements
    .map((el: Record<string, unknown>) => {
      const lat = (el as { lat?: number; center?: { lat?: number } }).lat ?? (el as { center?: { lat?: number } }).center?.lat
      const lon = (el as { lon?: number; center?: { lon?: number } }).lon ?? (el as { center?: { lon?: number } }).center?.lon
      if (typeof lat !== 'number' || typeof lon !== 'number') return null
      const tags = (el as { tags?: Record<string, string> }).tags || {}
      return {
        id: `${(el as { type?: string }).type || 'node'}/${(el as { id?: number }).id ?? 'unknown'}`,
        lat,
        lon,
        name: tags.name ?? null,
        type: tags.amenity || tags.man_made || tags.natural || tags.fountain || 'other',
      }
    })
    .filter((s: unknown): s is { id: string; lat: number; lon: number; name: string | null; type: string } => Boolean(s))

  const body = json({ sources, attribution: '© OpenStreetMap contributors (ODbL)' }, 200)
  await caches.default.put(cacheKey, body.clone())
  return body
}
