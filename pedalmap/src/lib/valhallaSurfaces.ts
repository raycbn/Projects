import type { BikeType, SurfaceStats } from '@/domain/types'
import { SURFACE, WAYTYPE, scoreSurfaceSuitability } from '@/lib/bikeSurfaceProfile'

/** Valhalla edge.surface values → Spanish label + ORS-like id for shared scorer. */
const SURFACE_MAP: Record<string, { type: string; value: number; paved: boolean }> = {
  paved_smooth: { type: 'Asfalto liso', value: SURFACE.asphalt, paved: true },
  paved: { type: 'Pavimentado', value: SURFACE.paved, paved: true },
  paved_rough: { type: 'Pavimento irregular', value: SURFACE.pavingStones, paved: true },
  compacted: { type: 'Grava compacta', value: SURFACE.compacted, paved: false },
  gravel: { type: 'Grava', value: SURFACE.gravel, paved: false },
  dirt: { type: 'Tierra', value: SURFACE.dirt, paved: false },
  path: { type: 'Sendero', value: SURFACE.unpaved, paved: false },
  impassable: { type: 'Intransitable', value: SURFACE.ice, paved: false },
}

const ROAD_CLASS_WAY: Record<string, { type: string; value: number }> = {
  motorway: { type: 'Vía principal', value: WAYTYPE.stateRoad },
  trunk: { type: 'Vía principal', value: WAYTYPE.stateRoad },
  primary: { type: 'Carretera', value: WAYTYPE.road },
  secondary: { type: 'Carretera', value: WAYTYPE.road },
  tertiary: { type: 'Calle', value: WAYTYPE.street },
  unclassified: { type: 'Calle', value: WAYTYPE.street },
  residential: { type: 'Calle', value: WAYTYPE.street },
  service_other: { type: 'Calle', value: WAYTYPE.street },
  cycleway: { type: 'Carril bici', value: WAYTYPE.cycleway },
  footway: { type: 'Peatonal', value: WAYTYPE.footway },
  pedestrian: { type: 'Peatonal', value: WAYTYPE.footway },
  path: { type: 'Sendero', value: WAYTYPE.path },
  track: { type: 'Pista', value: WAYTYPE.track },
}

export interface ValhallaEdgeAttr {
  length?: number // km
  surface?: string
  road_class?: string
  use?: string
  cycle_lane?: string
  bicycle_network?: number
}

/** Valhalla's edge.bicycle_network bitmask: 1=lcn, 2=rcn, 4=ncn, 8=icn. */
function hasSignedCycleNetwork(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isCycleInfrastructure(edge: ValhallaEdgeAttr): boolean {
  const use = (edge.use || '').toLowerCase()
  const roadClass = (edge.road_class || '').toLowerCase()
  const lane = (edge.cycle_lane || '').toLowerCase()
  if (use === 'cycleway' || roadClass === 'cycleway') return true
  if (lane && lane !== 'none') return true
  return hasSignedCycleNetwork(edge.bicycle_network)
}

/**
 * Build PedalMap SurfaceStats from Valhalla trace_attributes edges.
 * Lengths from Valhalla are kilometers.
 */
export function surfaceStatsFromValhallaEdges(
  bikeType: BikeType,
  edges: ValhallaEdgeAttr[],
): SurfaceStats {
  const surfaceDist = new Map<number, { type: string; meters: number }>()
  const wayDist = new Map<number, { type: string; meters: number }>()
  let pavedM = 0
  let unpavedM = 0
  let unknownM = 0
  let totalM = 0
  let cycleNetworkM = 0
  let cycleInfraM = 0

  for (const edge of edges) {
    const meters = Math.max(0, (edge.length ?? 0) * 1000)
    if (meters <= 0) continue
    totalM += meters
    if (hasSignedCycleNetwork(edge.bicycle_network)) cycleNetworkM += meters
    if (isCycleInfrastructure(edge)) cycleInfraM += meters

    const surfKey = (edge.surface || '').toLowerCase()
    const mapped = SURFACE_MAP[surfKey]
    if (mapped) {
      const prev = surfaceDist.get(mapped.value) ?? { type: mapped.type, meters: 0 }
      prev.meters += meters
      surfaceDist.set(mapped.value, prev)
      if (mapped.paved) pavedM += meters
      else unpavedM += meters
    } else {
      unknownM += meters
    }

    const use = (edge.use || '').toLowerCase()
    const roadClass = (edge.road_class || '').toLowerCase()
    let way =
      use === 'cycleway' || roadClass === 'cycleway'
        ? ROAD_CLASS_WAY.cycleway
        : use === 'footway' || use === 'sidewalk'
          ? ROAD_CLASS_WAY.footway
          : use === 'path'
            ? ROAD_CLASS_WAY.path
            : use === 'track'
              ? ROAD_CLASS_WAY.track
              : ROAD_CLASS_WAY[roadClass]

    if (!way && edge.cycle_lane && edge.cycle_lane !== 'none') {
      way = ROAD_CLASS_WAY.cycleway
    }
    if (way) {
      const prev = wayDist.get(way.value) ?? { type: way.type, meters: 0 }
      prev.meters += meters
      wayDist.set(way.value, prev)
    }
  }

  const denom = totalM || 1
  const surfaces = [...surfaceDist.entries()]
    .map(([value, row]) => ({
      type: row.type,
      distanceMeters: row.meters,
      value,
    }))
    .sort((a, b) => b.distanceMeters - a.distanceMeters)

  const waytypes = [...wayDist.entries()]
    .map(([value, row]) => ({
      type: row.type,
      distanceMeters: row.meters,
      percent: (row.meters / denom) * 100,
      value,
    }))
    .sort((a, b) => b.distanceMeters - a.distanceMeters)

  const stats: SurfaceStats = {
    pavedPercent: (pavedM / denom) * 100,
    unpavedPercent: (unpavedM / denom) * 100,
    unknownPercent: (unknownM / denom) * 100,
    surfaces,
    waytypes,
    cycleNetworkPercent: (cycleNetworkM / denom) * 100,
    cycleInfraPercent: (cycleInfraM / denom) * 100,
  }

  stats.suitability = scoreSurfaceSuitability(bikeType, stats)
  return stats
}
