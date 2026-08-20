/**
 * Free, public-data map overlays — the presentation half of PedalMap's
 * Strava-lite "where cyclists actually go" signal (see valhallaSurfaces.ts /
 * routeOptions.ts for the routing-side counterpart).
 *
 * We cannot use Strava's heatmap tiles (their license only allows tracing
 * into OSM, not use inside another product). Waymarked Trails renders the
 * same OSM signed cycle-network relations (EuroVelo, Vías Verdes, redes
 * locales) that feed our own cycleNetworkPercent stat — no API key, no
 * scraping, fully attributable.
 */

export const CYCLE_NETWORK_TILE_URL = 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'

export const CYCLE_NETWORK_ATTRIBUTION =
  'Redes ciclistas: © Waymarked Trails (waymarkedtrails.org) · datos OSM'

const STORAGE_KEY = 'pedalmap_show_cycle_network_overlay'

/** Off by default — this is an opt-in visual layer, never a routing input. */
export function readCycleNetworkOverlayPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeCycleNetworkOverlayPreference(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* ignore (private mode / storage disabled) */
  }
}

const WATER_SOURCES_STORAGE_KEY = 'pedalmap_show_water_sources_overlay'

export function readWaterSourcesOverlayPreference(): boolean {
  try {
    return localStorage.getItem(WATER_SOURCES_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeWaterSourcesOverlayPreference(on: boolean): void {
  try {
    localStorage.setItem(WATER_SOURCES_STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* ignore (private mode / storage disabled) */
  }
}
