import type { BikeType, RoutePreference } from '@/domain/types'

/**
 * Valhalla bicycle costing — surface is applied DURING pathfinding
 * (unlike ORS, which cannot hard-filter cycling surfaces).
 *
 * @see https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
 */
export type ValhallaBicycleType = 'Road' | 'Hybrid' | 'Cross' | 'Mountain'

export interface ValhallaBicycleCosting {
  bicycle_type: ValhallaBicycleType
  /** 0 = ignore surface penalties; 1 = disallow bad surfaces for this bike. */
  avoid_bad_surfaces: number
  /** 0 = prefer paths/tracks; 1 = prefer roads. */
  use_roads: number
  /** 0 = avoid hills; 1 = don't mind hills. */
  use_hills: number
  use_ferry?: number
  cycling_speed?: number
}

export interface BikeValhallaProfile {
  bikeType: BikeType
  label: string
  costing: ValhallaBicycleCosting
  blurb: string
}

/**
 * Commercial modality map: each PedalMap bike → Valhalla costing that
 * actually changes which edges are chosen.
 */
export const BIKE_VALHALLA_PROFILES: Record<BikeType, BikeValhallaProfile> = {
  road: {
    bikeType: 'road',
    label: 'Carretera',
    blurb: 'Valhalla Road + avoid_bad_surfaces=1: prioriza pavimento liso, evita tierra/grava.',
    costing: {
      bicycle_type: 'Road',
      avoid_bad_surfaces: 1,
      use_roads: 0.55,
      use_hills: 0.12,
      use_ferry: 0.1,
      cycling_speed: 25,
    },
  },
  urban: {
    bikeType: 'urban',
    label: 'Urbana',
    blurb: 'Hybrid/city: carriles y calles calmadas, castiga mal pavimento.',
    costing: {
      bicycle_type: 'Hybrid',
      avoid_bad_surfaces: 0.92,
      use_roads: 0.5,
      use_hills: 0.18,
      use_ferry: 0.15,
      cycling_speed: 18,
    },
  },
  ebike: {
    bikeType: 'ebike',
    label: 'E-bike',
    blurb: 'Hybrid con más tolerancia a desnivel; sigue evitando suelo malo.',
    costing: {
      bicycle_type: 'Hybrid',
      avoid_bad_surfaces: 0.88,
      use_roads: 0.55,
      use_hills: 0.45,
      use_ferry: 0.2,
      cycling_speed: 22,
    },
  },
  gravel: {
    bikeType: 'gravel',
    label: 'Gravel',
    blurb: 'Cross: mezcla asfalto + compacta/grava; no castiga tanto lo no pavimentado.',
    costing: {
      bicycle_type: 'Cross',
      avoid_bad_surfaces: 0.28,
      use_roads: 0.32,
      use_hills: 0.42,
      use_ferry: 0.15,
      cycling_speed: 20,
    },
  },
  mtb: {
    bikeType: 'mtb',
    label: 'MTB',
    blurb: 'Mountain: permite tierra/grava/sendero; baja preferencia por asfalto denso.',
    costing: {
      bicycle_type: 'Mountain',
      avoid_bad_surfaces: 0.05,
      use_roads: 0.18,
      use_hills: 0.62,
      use_ferry: 0.1,
      cycling_speed: 16,
    },
  },
}

export function getValhallaCosting(
  bikeType: BikeType,
  preferences: RoutePreference[] = [],
): ValhallaBicycleCosting {
  const base = { ...BIKE_VALHALLA_PROFILES[bikeType].costing }

  if (preferences.includes('avoid_unpaved')) {
    base.avoid_bad_surfaces = Math.min(1, Math.max(base.avoid_bad_surfaces, 0.95))
    base.use_roads = Math.max(base.use_roads, 0.55)
  }
  if (preferences.includes('prefer_unpaved')) {
    base.bicycle_type = bikeType === 'road' ? 'Cross' : base.bicycle_type
    if (bikeType === 'road' || bikeType === 'urban' || bikeType === 'ebike') {
      base.bicycle_type = 'Cross'
    } else {
      base.bicycle_type = 'Mountain'
    }
    base.avoid_bad_surfaces = Math.min(base.avoid_bad_surfaces, 0.2)
    base.use_roads = Math.min(base.use_roads, 0.25)
  }
  if (preferences.includes('prefer_less_elevation')) {
    base.use_hills = Math.min(base.use_hills, 0.1)
  }
  if (preferences.includes('prefer_bike_lanes') || preferences.includes('avoid_primary_roads')) {
    base.use_roads = Math.min(base.use_roads, 0.35)
  }
  if (preferences.includes('prefer_secondary_roads')) {
    base.use_roads = Math.min(Math.max(base.use_roads, 0.35), 0.5)
  }
  if (preferences.includes('avoid_traffic')) {
    base.use_roads = Math.min(base.use_roads, 0.4)
  }

  return base
}
