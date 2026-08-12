/**
 * Free 3D terrain for MapLibre (Mapterhorn DEM + OpenFreeMap basemap).
 * No API key required.
 */

export const MAP_TERRAIN_SOURCE_ID = 'pedalmap-terrain'
export const MAP_HILLSHADE_SOURCE_ID = 'pedalmap-hillshade'
export const MAP_HILLSHADE_LAYER_ID = 'pedalmap-hillshade'

/** Terrarium DEM — global, free for MapLibre terrain / hillshade. */
export const MAP_TERRAIN_TILEJSON = 'https://tiles.mapterhorn.com/tilejson.json'

const PREF_KEY = 'pedalmap_map_3d'

export function readMap3dPreference(defaultOn = true): boolean {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw === null) return defaultOn
    return raw === '1'
  } catch {
    return defaultOn
  }
}

export function writeMap3dPreference(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Approx initial bearing along a LineString (degrees, MapLibre convention). */
export function routeStartBearing(
  coordinates: [number, number][],
): number {
  if (coordinates.length < 2) return 0
  const from = coordinates[0]
  const to = coordinates[Math.min(coordinates.length - 1, Math.max(1, Math.floor(coordinates.length * 0.06)))]
  return bearingDegrees(from, to)
}

function bearingDegrees(from: [number, number], to: [number, number]): number {
  const lng1 = (from[0] * Math.PI) / 180
  const lat1 = (from[1] * Math.PI) / 180
  const lng2 = (to[0] * Math.PI) / 180
  const lat2 = (to[1] * Math.PI) / 180
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
