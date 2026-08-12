/**
 * Map tile / style provider abstraction.
 * MapView reads VITE_MAP_STYLE_URL so providers can be swapped without UI rewrites.
 *
 * Default: OpenFreeMap Liberty (free, no key) + optional Mapterhorn 3D terrain in MapView.
 */

export interface MapTileProviderInfo {
  id: string
  styleUrl: string
  requiresKey: boolean
  notes: string
}

export function getMapStyleUrl(): string {
  return (
    import.meta.env.VITE_MAP_STYLE_URL ||
    'https://tiles.openfreemap.org/styles/liberty'
  )
}

/** Reliable open glyph CDN when OpenFreeMap font stacks 404. */
export const FALLBACK_GLYPHS =
  'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'

/**
 * Fetch style JSON and patch glyphs to reduce console font noise on OpenFreeMap.
 * Falls back to the raw URL string if fetch fails.
 */
export async function loadMapStyleSpec(): Promise<string | Record<string, unknown>> {
  const url = getMapStyleUrl()
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const style = (await res.json()) as Record<string, unknown>
    const glyphs = style.glyphs
    if (
      typeof glyphs !== 'string' ||
      glyphs.includes('openfreemap')
    ) {
      style.glyphs = FALLBACK_GLYPHS
    }
    return style
  } catch {
    return url
  }
}

export const DEFAULT_TILE_PROVIDER: MapTileProviderInfo = {
  id: 'openfreemap',
  styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  requiresKey: false,
  notes:
    'OpenFreeMap — free vector tiles. MapView can overlay free Mapterhorn DEM for 3D terrain.',
}
