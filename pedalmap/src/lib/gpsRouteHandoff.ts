/**
 * Pass a planned route into the GPS recorder / navigation without stuffing
 * geometry in the URL.
 */
const GPS_ROUTE_KEY = 'pedalmap_gps_route'
const NAV_INSTRUCTIONS_KEY = 'pedalmap_nav_instructions'

export type GpsRoutePacket = {
  title: string
  bikeType: string
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  instructions?: string[]
}

export function stashGpsRoute(packet: GpsRoutePacket): void {
  try {
    sessionStorage.setItem(GPS_ROUTE_KEY, JSON.stringify(packet))
    if (packet.instructions?.length) {
      sessionStorage.setItem(NAV_INSTRUCTIONS_KEY, JSON.stringify(packet.instructions))
    } else {
      sessionStorage.removeItem(NAV_INSTRUCTIONS_KEY)
    }
  } catch {
    /* ignore */
  }
}

export function takeGpsRoute(): GpsRoutePacket | null {
  try {
    const raw = sessionStorage.getItem(GPS_ROUTE_KEY)
    if (!raw) return null
    // Keep for navigation re-entry; activity page may also consume.
    return JSON.parse(raw) as GpsRoutePacket
  } catch {
    return null
  }
}

export function peekNavInstructions(): string[] {
  try {
    const raw = sessionStorage.getItem(NAV_INSTRUCTIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}
