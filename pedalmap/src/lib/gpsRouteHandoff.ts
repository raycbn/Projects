/**
 * Pass a planned route into the GPS recorder without stuffing geometry in the URL.
 */
const GPS_ROUTE_KEY = 'pedalmap_gps_route'

export type GpsRoutePacket = {
  title: string
  bikeType: string
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
}

export function stashGpsRoute(packet: GpsRoutePacket): void {
  try {
    sessionStorage.setItem(GPS_ROUTE_KEY, JSON.stringify(packet))
  } catch {
    /* ignore */
  }
}

export function takeGpsRoute(): GpsRoutePacket | null {
  try {
    const raw = sessionStorage.getItem(GPS_ROUTE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(GPS_ROUTE_KEY)
    return JSON.parse(raw) as GpsRoutePacket
  } catch {
    return null
  }
}
