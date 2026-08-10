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
  /** Cumulative meters along the route where each instruction becomes active. */
  instructionAtMeters?: number[]
  surfaceEdges?: Array<{
    length?: number
    surface?: number | string | null
    road_class?: number | string | null
    use?: number | string | null
    cycle_lane?: number | string | null
  }>
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

/** Evenly space instruction thresholds along total route distance. */
export function buildInstructionAtMeters(
  instructions: string[] | undefined,
  totalDistanceMeters: number,
): number[] {
  const n = instructions?.length ?? 0
  if (n === 0) return []
  const total = Math.max(0, totalDistanceMeters)
  return Array.from({ length: n }, (_, i) => (total * i) / n)
}

/** Pick instruction index from distance along the route (meters). */
export function instructionStepFromDistance(
  alongMeters: number,
  instructionAtMeters: number[],
): number {
  if (!instructionAtMeters.length) return 0
  let step = 0
  for (let i = 0; i < instructionAtMeters.length; i += 1) {
    if (alongMeters >= instructionAtMeters[i]) step = i
  }
  return Math.min(instructionAtMeters.length - 1, step)
}
