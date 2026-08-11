import type { BikeType, RoutePreference, SurfaceStats } from '@/domain/types'

/** ORS surface IDs (official table). */
export const SURFACE = {
  unknown: 0,
  paved: 1,
  unpaved: 2,
  asphalt: 3,
  concrete: 4,
  pavingStones: 5,
  metal: 6,
  wood: 7,
  compacted: 8,
  fineGravel: 9,
  gravel: 10,
  dirt: 11,
  ground: 12,
  ice: 13,
  sett: 14,
  sand: 15,
  woodchips: 16,
  grass: 17,
  grassPaver: 18,
} as const

/** ORS waytype IDs. */
export const WAYTYPE = {
  unknown: 0,
  stateRoad: 1,
  road: 2,
  street: 3,
  path: 4,
  track: 5,
  cycleway: 6,
  footway: 7,
  steps: 8,
  ferry: 9,
  construction: 10,
} as const

export type SuitabilityLabel = 'excelente' | 'buena' | 'aceptable' | 'poco_adecuada'

export interface SurfaceSuitability {
  score: number
  label: SuitabilityLabel
  notes: string[]
  bikeType: BikeType
}

export interface RoutingStrategy {
  id: string
  profile: string
  preferenceMode: 'recommended' | 'shortest' | 'fastest'
  avoidFeatures: string[]
  weightings: Record<string, number>
}

export interface BikeModalityProfile {
  bikeType: BikeType
  label: string
  /** Short UI blurb: what surfaces/ways this modality wants. */
  blurb: string
  /** Ideal surfaces for the rider (Spanish, for UI). */
  idealSurfaces: string[]
  /** Surfaces to avoid (Spanish). */
  avoidSurfaces: string[]
  /** Primary + alternate ORS strategies to try for best surface fit. */
  strategies: RoutingStrategy[]
  /** Soft target: stop searching strategies once a candidate reaches this score. */
  acceptScore: number
  surfaceWeights: Record<number, number>
  waytypeWeights: Record<number, number>
}

function strategy(
  id: string,
  profile: string,
  partial: Partial<Omit<RoutingStrategy, 'id' | 'profile'>> = {},
): RoutingStrategy {
  return {
    id,
    profile,
    preferenceMode: partial.preferenceMode ?? 'recommended',
    avoidFeatures: partial.avoidFeatures ?? ['steps'],
    weightings: partial.weightings ?? {},
  }
}

/**
 * Hyper-precise modality policies: ORS profile + soft weightings + post-route
 * surface/waytype scoring (ORS has no hard surface avoid on cycling profiles).
 */
export const BIKE_MODALITY_PROFILES: Record<BikeType, BikeModalityProfile> = {
  road: {
    bikeType: 'road',
    label: 'Carretera',
    blurb:
      'Prioriza asfalto/hormigón y vías ciclistas o carreteras. Evita tierra, grava suelta, senderos y pistas.',
    idealSurfaces: ['Asfalto', 'Hormigón', 'Pavimentado', 'Carril bici'],
    avoidSurfaces: ['Tierra', 'Grava', 'Arena', 'Hierba', 'Sendero', 'Pista'],
    acceptScore: 90,
    strategies: [
      strategy('road-primary', 'cycling-road', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: {},
      }),
      strategy('road-quiet', 'cycling-road', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 0.55 },
      }),
      strategy('road-fast', 'cycling-road', {
        preferenceMode: 'fastest',
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { steepness_difficulty: 0 },
      }),
      strategy('road-regular-paved', 'cycling-regular', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 0.35, steepness_difficulty: 0 },
      }),
      strategy('road-shortest-paved', 'cycling-road', {
        preferenceMode: 'shortest',
        avoidFeatures: ['steps', 'ferries', 'fords'],
      }),
    ],
    surfaceWeights: {
      [SURFACE.asphalt]: 1.2,
      [SURFACE.concrete]: 1.0,
      [SURFACE.paved]: 0.95,
      [SURFACE.pavingStones]: 0.25,
      [SURFACE.sett]: 0.15,
      [SURFACE.grassPaver]: 0.1,
      [SURFACE.metal]: -0.4,
      [SURFACE.wood]: -0.6,
      [SURFACE.compacted]: -0.85,
      [SURFACE.fineGravel]: -1.0,
      [SURFACE.gravel]: -1.2,
      [SURFACE.unpaved]: -1.2,
      [SURFACE.dirt]: -1.3,
      [SURFACE.ground]: -1.3,
      [SURFACE.sand]: -1.4,
      [SURFACE.woodchips]: -1.2,
      [SURFACE.grass]: -1.3,
      [SURFACE.ice]: -1.5,
      [SURFACE.unknown]: -0.05,
    },
    waytypeWeights: {
      [WAYTYPE.cycleway]: 1.15,
      [WAYTYPE.street]: 0.7,
      [WAYTYPE.road]: 0.55,
      [WAYTYPE.stateRoad]: 0.25,
      [WAYTYPE.footway]: -0.35,
      [WAYTYPE.path]: -1.15,
      [WAYTYPE.track]: -1.25,
      [WAYTYPE.steps]: -1.5,
      [WAYTYPE.ferry]: -0.8,
      [WAYTYPE.construction]: -1.0,
      [WAYTYPE.unknown]: -0.05,
    },
  },

  gravel: {
    bikeType: 'gravel',
    label: 'Gravel',
    blurb:
      'Mezcla ideal: grava compacta, pistas y caminos anchos, con algo de asfalto. Evita singletrack técnico, arena y barro profundo.',
    idealSurfaces: ['Grava compacta', 'Grava fina', 'Grava', 'Pista', 'Asfalto ligero'],
    avoidSurfaces: ['Arena', 'Hierba', 'Sendero muy estrecho', 'Escaleras'],
    acceptScore: 90,
    strategies: [
      // Regular + green finds mixed/quiet roads better for gravel adventure.
      strategy('gravel-mixed', 'cycling-regular', {
        avoidFeatures: ['steps', 'ferries'],
        weightings: { green: 0.75 },
      }),
      strategy('gravel-tracks', 'cycling-mountain', {
        avoidFeatures: ['steps', 'ferries'],
        weightings: { green: 0.55, steepness_difficulty: 1 },
      }),
      strategy('gravel-road-link', 'cycling-road', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 0.4 },
      }),
    ],
    surfaceWeights: {
      [SURFACE.compacted]: 1.25,
      [SURFACE.fineGravel]: 1.2,
      [SURFACE.gravel]: 1.1,
      [SURFACE.asphalt]: 0.55,
      [SURFACE.concrete]: 0.4,
      [SURFACE.paved]: 0.45,
      [SURFACE.dirt]: 0.35,
      [SURFACE.ground]: 0.2,
      [SURFACE.unpaved]: 0.55,
      [SURFACE.pavingStones]: 0.15,
      [SURFACE.sett]: 0.1,
      [SURFACE.woodchips]: -0.2,
      [SURFACE.grass]: -0.55,
      [SURFACE.sand]: -1.2,
      [SURFACE.ice]: -1.4,
      [SURFACE.metal]: -0.5,
      [SURFACE.wood]: -0.4,
      [SURFACE.unknown]: 0,
    },
    waytypeWeights: {
      [WAYTYPE.track]: 1.2,
      [WAYTYPE.path]: 0.35,
      [WAYTYPE.cycleway]: 0.55,
      [WAYTYPE.street]: 0.45,
      [WAYTYPE.road]: 0.5,
      [WAYTYPE.stateRoad]: 0.2,
      [WAYTYPE.footway]: -0.25,
      [WAYTYPE.steps]: -1.4,
      [WAYTYPE.ferry]: -0.6,
      [WAYTYPE.construction]: -0.8,
      [WAYTYPE.unknown]: 0,
    },
  },

  mtb: {
    bikeType: 'mtb',
    label: 'MTB',
    blurb:
      'Prioriza senderos, pistas y tierra/grava. Evita autovía urbana densa; el asfalto largo baja la idoneidad.',
    idealSurfaces: ['Tierra', 'Grava', 'Sendero', 'Pista', 'Suelo'],
    avoidSurfaces: ['Solo asfalto urbano', 'Escaleras', 'Ferry'],
    acceptScore: 90,
    strategies: [
      strategy('mtb-primary', 'cycling-mountain', {
        avoidFeatures: ['steps', 'ferries'],
        weightings: { green: 1, steepness_difficulty: 2 },
      }),
      strategy('mtb-soft', 'cycling-mountain', {
        avoidFeatures: ['steps'],
        weightings: { green: 0.85, steepness_difficulty: 1 },
      }),
      strategy('mtb-mixed', 'cycling-regular', {
        avoidFeatures: ['steps', 'ferries'],
        weightings: { green: 1 },
      }),
    ],
    surfaceWeights: {
      [SURFACE.dirt]: 1.25,
      [SURFACE.ground]: 1.15,
      [SURFACE.gravel]: 1.05,
      [SURFACE.fineGravel]: 0.95,
      [SURFACE.compacted]: 0.9,
      [SURFACE.unpaved]: 1.0,
      [SURFACE.woodchips]: 0.55,
      [SURFACE.grass]: 0.45,
      [SURFACE.sand]: 0.15,
      [SURFACE.asphalt]: -0.55,
      [SURFACE.concrete]: -0.6,
      [SURFACE.paved]: -0.5,
      [SURFACE.pavingStones]: -0.35,
      [SURFACE.sett]: -0.3,
      [SURFACE.ice]: -0.8,
      [SURFACE.metal]: -0.5,
      [SURFACE.wood]: 0.2,
      [SURFACE.unknown]: 0.05,
    },
    waytypeWeights: {
      [WAYTYPE.path]: 1.25,
      [WAYTYPE.track]: 1.2,
      [WAYTYPE.cycleway]: 0.15,
      [WAYTYPE.street]: -0.25,
      [WAYTYPE.road]: -0.35,
      [WAYTYPE.stateRoad]: -0.7,
      [WAYTYPE.footway]: 0.2,
      [WAYTYPE.steps]: -1.2,
      [WAYTYPE.ferry]: -0.9,
      [WAYTYPE.construction]: -0.6,
      [WAYTYPE.unknown]: 0,
    },
  },

  urban: {
    bikeType: 'urban',
    label: 'Urbana',
    blurb:
      'Carriles bici, calles calmadas y pavimento. Evita pistas, tierra y tramos sin pavimentar.',
    idealSurfaces: ['Carril bici', 'Asfalto', 'Calle', 'Pavimentado'],
    avoidSurfaces: ['Pista', 'Tierra', 'Grava', 'Sendero'],
    acceptScore: 90,
    strategies: [
      strategy('urban-lanes', 'cycling-regular', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 1, steepness_difficulty: 0 },
      }),
      strategy('urban-quiet', 'cycling-regular', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 0.85 },
      }),
      strategy('urban-electric', 'cycling-electric', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 0.9, steepness_difficulty: 0 },
      }),
    ],
    surfaceWeights: {
      [SURFACE.asphalt]: 1.1,
      [SURFACE.concrete]: 1.0,
      [SURFACE.paved]: 0.95,
      [SURFACE.pavingStones]: 0.55,
      [SURFACE.sett]: 0.45,
      [SURFACE.grassPaver]: 0.35,
      [SURFACE.compacted]: -0.5,
      [SURFACE.fineGravel]: -0.7,
      [SURFACE.gravel]: -0.95,
      [SURFACE.unpaved]: -1.0,
      [SURFACE.dirt]: -1.15,
      [SURFACE.ground]: -1.15,
      [SURFACE.sand]: -1.3,
      [SURFACE.grass]: -0.9,
      [SURFACE.woodchips]: -0.8,
      [SURFACE.ice]: -1.4,
      [SURFACE.unknown]: -0.05,
    },
    waytypeWeights: {
      [WAYTYPE.cycleway]: 1.3,
      [WAYTYPE.street]: 0.85,
      [WAYTYPE.footway]: 0.15,
      [WAYTYPE.road]: 0.2,
      [WAYTYPE.stateRoad]: -0.55,
      [WAYTYPE.path]: -0.9,
      [WAYTYPE.track]: -1.15,
      [WAYTYPE.steps]: -1.5,
      [WAYTYPE.ferry]: -0.7,
      [WAYTYPE.construction]: -0.9,
      [WAYTYPE.unknown]: -0.05,
    },
  },

  ebike: {
    bikeType: 'ebike',
    label: 'E-bike',
    blurb:
      'Pavimento y carril bici con perfil eléctrico (acepta más desnivel). Evita senderos técnicos y sin pavimentar exigente.',
    idealSurfaces: ['Asfalto', 'Carril bici', 'Calle', 'Hormigón'],
    avoidSurfaces: ['Sendero técnico', 'Arena', 'Barro', 'Escaleras'],
    acceptScore: 90,
    strategies: [
      strategy('ebike-primary', 'cycling-electric', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 0.7 },
      }),
      strategy('ebike-lanes', 'cycling-electric', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 1, steepness_difficulty: 0 },
      }),
      strategy('ebike-regular', 'cycling-regular', {
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 0.75 },
      }),
    ],
    surfaceWeights: {
      [SURFACE.asphalt]: 1.1,
      [SURFACE.concrete]: 1.0,
      [SURFACE.paved]: 0.95,
      [SURFACE.pavingStones]: 0.5,
      [SURFACE.sett]: 0.4,
      [SURFACE.compacted]: -0.25,
      [SURFACE.fineGravel]: -0.45,
      [SURFACE.gravel]: -0.7,
      [SURFACE.unpaved]: -0.75,
      [SURFACE.dirt]: -0.95,
      [SURFACE.ground]: -0.95,
      [SURFACE.sand]: -1.25,
      [SURFACE.grass]: -0.85,
      [SURFACE.woodchips]: -0.7,
      [SURFACE.ice]: -1.4,
      [SURFACE.unknown]: -0.05,
    },
    waytypeWeights: {
      [WAYTYPE.cycleway]: 1.2,
      [WAYTYPE.street]: 0.8,
      [WAYTYPE.road]: 0.35,
      [WAYTYPE.stateRoad]: -0.15,
      [WAYTYPE.footway]: 0.05,
      [WAYTYPE.path]: -0.85,
      [WAYTYPE.track]: -0.7,
      [WAYTYPE.steps]: -1.5,
      [WAYTYPE.ferry]: -0.7,
      [WAYTYPE.construction]: -0.9,
      [WAYTYPE.unknown]: -0.05,
    },
  },
}

export function getBikeModality(bikeType: BikeType): BikeModalityProfile {
  return BIKE_MODALITY_PROFILES[bikeType]
}

/**
 * Merge user preferences onto modality defaults → concrete ORS strategy list.
 * User prefs can force profile swaps (prefer_unpaved → mountain, etc.).
 */
export function resolveRoutingStrategies(
  bikeType: BikeType,
  preferences: RoutePreference[] = [],
): RoutingStrategy[] {
  const modality = getBikeModality(bikeType)
  let strategies = modality.strategies.map((s) => ({
    ...s,
    avoidFeatures: [...s.avoidFeatures],
    weightings: { ...s.weightings },
  }))

  // User preference overrides applied to every candidate.
  const preferMode: RoutingStrategy['preferenceMode'] = preferences.includes('prefer_shorter')
    ? 'shortest'
    : preferences.includes('prefer_faster')
      ? 'fastest'
      : 'recommended'

  strategies = strategies.map((s) => {
    const next = {
      ...s,
      preferenceMode: preferMode,
      avoidFeatures: [...s.avoidFeatures],
      weightings: { ...s.weightings },
    }

    if (preferences.includes('avoid_traffic')) {
      for (const f of ['ferries', 'fords'] as const) {
        if (!next.avoidFeatures.includes(f)) next.avoidFeatures.push(f)
      }
    }

    if (preferences.includes('prefer_less_elevation')) {
      next.weightings.steepness_difficulty = 0
    } else if (preferences.includes('prefer_unpaved') && next.weightings.steepness_difficulty == null) {
      next.weightings.steepness_difficulty = 2
    }

    if (
      preferences.includes('prefer_secondary_roads') ||
      preferences.includes('avoid_primary_roads') ||
      preferences.includes('prefer_bike_lanes')
    ) {
      const green = preferences.includes('avoid_primary_roads') ? 1 : 0.85
      next.weightings.green = Math.max(next.weightings.green ?? 0, green)
    }

    return next
  })

  // Hard profile redirects from prefs.
  if (preferences.includes('prefer_unpaved')) {
    strategies = [
      strategy('pref-unpaved', 'cycling-mountain', {
        preferenceMode: preferMode,
        avoidFeatures: ['steps'],
        weightings: { green: 1, steepness_difficulty: 2 },
      }),
      ...strategies,
    ]
  }
  if (preferences.includes('avoid_unpaved') && (bikeType === 'mtb' || bikeType === 'gravel')) {
    strategies = [
      strategy('pref-avoid-unpaved', 'cycling-regular', {
        preferenceMode: preferMode,
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 0.4, steepness_difficulty: 0 },
      }),
      ...strategies,
    ]
  }
  if (preferences.includes('prefer_bike_lanes') && bikeType !== 'mtb') {
    strategies = [
      strategy('pref-bike-lanes', 'cycling-regular', {
        preferenceMode: preferMode,
        avoidFeatures: ['steps', 'ferries', 'fords'],
        weightings: { green: 1, steepness_difficulty: 0 },
      }),
      ...strategies,
    ]
  }

  // Dedupe by profile+weight signature, keep order.
  const seen = new Set<string>()
  return strategies.filter((s) => {
    const key = `${s.profile}|${s.preferenceMode}|${s.avoidFeatures.join(',')}|${JSON.stringify(s.weightings)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Primary ORS profile for UI / simple mapBikeProfile. */
export function primaryOrsProfile(
  bikeType: BikeType,
  preferences: RoutePreference[] = [],
): string {
  return resolveRoutingStrategies(bikeType, preferences)[0]?.profile ?? 'cycling-regular'
}

/** Soft target score when searching for the best route for a bike profile (not a hard reject). */
export const PROFILE_MIN_SCORE = 90

function labelFromScore(score: number): SuitabilityLabel {
  if (score >= 90) return 'excelente'
  if (score >= 75) return 'buena'
  if (score >= 55) return 'aceptable'
  return 'poco_adecuada'
}

function distanceShare(
  rows: Array<{ distanceMeters: number; value?: number }>,
  allowed: Set<number>,
): number {
  const total = rows.reduce((sum, row) => sum + row.distanceMeters, 0)
  if (total <= 0) return 0
  const good = rows.reduce(
    (sum, row) => (row.value != null && allowed.has(row.value) ? sum + row.distanceMeters : sum),
    0,
  )
  return (good / total) * 100
}

function wayShare(
  rows: Array<{ distanceMeters: number; percent: number; value?: number; type: string }>,
  allowed: Set<number>,
): number {
  const normalized = rows.map((row) => ({
    distanceMeters: row.distanceMeters,
    value: row.value ?? waytypeIdFromLabel(row.type),
  }))
  return distanceShare(normalized, allowed)
}

/**
 * Score 0–100 how well ORS surface/waytype extras fit the bike modality.
 * Used to rank candidate routes; PROFILE_MIN_SCORE is a soft “óptima” band.
 */
export function scoreSurfaceSuitability(
  bikeType: BikeType,
  surfaceStats: SurfaceStats | undefined,
): SurfaceSuitability {
  const modality = getBikeModality(bikeType)
  const notes: string[] = []

  if (!surfaceStats?.surfaces?.length && !surfaceStats?.waytypes?.length) {
    return {
      score: 40,
      label: 'poco_adecuada',
      notes: [
        'ORS no devolvió detalle de superficie; la idoneidad es orientativa para este perfil.',
      ],
      bikeType,
    }
  }

  const surfaces = surfaceStats.surfaces ?? []
  const waytypes = surfaceStats.waytypes ?? []
  const paved = surfaceStats.pavedPercent ?? 0
  const unpaved = surfaceStats.unpavedPercent ?? 0

  const ROAD_SURFACES = new Set([
    SURFACE.paved,
    SURFACE.asphalt,
    SURFACE.concrete,
    SURFACE.pavingStones,
    SURFACE.sett,
    SURFACE.grassPaver,
  ])
  const MTB_SURFACES = new Set([
    SURFACE.dirt,
    SURFACE.ground,
    SURFACE.gravel,
    SURFACE.fineGravel,
    SURFACE.compacted,
    SURFACE.unpaved,
    SURFACE.woodchips,
    SURFACE.grass,
    SURFACE.wood,
  ])

  const ROAD_WAYS = new Set([WAYTYPE.cycleway, WAYTYPE.street, WAYTYPE.road, WAYTYPE.stateRoad])
  const MTB_WAYS = new Set([WAYTYPE.path, WAYTYPE.track, WAYTYPE.footway, WAYTYPE.cycleway])

  let score = 0

  if (bikeType === 'road' || bikeType === 'ebike') {
    const surf = surfaces.length ? distanceShare(surfaces, ROAD_SURFACES) : paved
    const ways = waytypes.length ? wayShare(waytypes, ROAD_WAYS) : surf
    const trailPenalty = wayShare(waytypes, new Set([WAYTYPE.path, WAYTYPE.track, WAYTYPE.steps]))
    score = Math.round(surf * 0.7 + ways * 0.3 - trailPenalty * 0.35)
    if (unpaved > 8) {
      score = Math.min(score, 88)
      notes.push(`Sin pavimentar ${Math.round(unpaved)}% (máx. recomendable ~8% en ${modality.label}).`)
    }
    // Hard gate: more than 12% dirt/track is never “road ready”.
    if (unpaved > 12 || trailPenalty > 15) {
      score = Math.min(score, 82)
    }
    if (surf >= 92 && trailPenalty < 8) {
      notes.push(`Pavimento/vías adecuadas ≈ ${Math.round(surf)}%.`)
    }
  } else if (bikeType === 'urban') {
    const surf = surfaces.length ? distanceShare(surfaces, ROAD_SURFACES) : paved
    const cycle = wayShare(waytypes, new Set([WAYTYPE.cycleway, WAYTYPE.street]))
    const bad = wayShare(waytypes, new Set([WAYTYPE.track, WAYTYPE.path, WAYTYPE.steps]))
    score = Math.round(surf * 0.55 + cycle * 0.45 - bad * 0.4)
    if (unpaved > 10) {
      score = Math.min(score, 85)
      notes.push(`Hay ${Math.round(unpaved)}% sin pavimentar: poco urbano.`)
    }
    if (unpaved > 15 || bad > 20) {
      score = Math.min(score, 80)
    }
    if (cycle >= 40) notes.push(`Buen peso de calle/carril bici (~${Math.round(cycle)}%).`)
  } else if (bikeType === 'gravel') {
    const gravelSurf = distanceShare(
      surfaces,
      new Set([
        SURFACE.compacted,
        SURFACE.fineGravel,
        SURFACE.gravel,
        SURFACE.unpaved,
        SURFACE.dirt,
        SURFACE.ground,
      ]),
    )
    const trackShare = wayShare(waytypes, new Set([WAYTYPE.track, WAYTYPE.path, WAYTYPE.road]))
    if (unpaved >= 25 && unpaved <= 75) {
      // Healthy gravel mix — start high and nudge with surface/way detail.
      score = Math.round(90 + Math.min(8, gravelSurf * 0.06) + Math.min(2, trackShare * 0.02))
      notes.push(`Mezcla gravel ~${Math.round(unpaved)}% sin pavimentar.`)
    } else if (unpaved < 25) {
      score = Math.round(Math.max(35, unpaved * 3.2 + gravelSurf * 0.25))
      if (unpaved < 15) score = Math.min(score, 82)
      notes.push('Demasiado asfalto para gravel (busca más pista/grava).')
    } else {
      score = Math.round(Math.max(35, (100 - unpaved) * 3.2 + trackShare * 0.2))
      score = Math.min(score, 86)
      notes.push('Casi sin asfalto: puede volverse demasiado técnico.')
    }
  } else {
    // mtb
    const surf = surfaces.length ? distanceShare(surfaces, MTB_SURFACES) : unpaved
    const trails = wayShare(waytypes, MTB_WAYS)
    const asphaltWays = wayShare(waytypes, new Set([WAYTYPE.stateRoad, WAYTYPE.road, WAYTYPE.street]))
    score = Math.round(surf * 0.55 + trails * 0.4 + Math.max(0, 100 - asphaltWays) * 0.05)
    if (paved > 55) {
      score = Math.min(score, 78)
      notes.push(`Demasiado asfalto (${Math.round(paved)}%) para MTB.`)
    } else if (unpaved >= 45 && trails >= 40) {
      notes.push(`Tierra/sendero/pista sólidos (~${Math.round(unpaved)}% sin pavimentar).`)
    }
  }

  // Soft weight blend as a tie-breaker (±6 pts) when extras exist.
  let soft = 0
  let softN = 0
  for (const row of surfaces) {
    if (row.value == null) continue
    soft += (modality.surfaceWeights[row.value] ?? 0) * row.distanceMeters
    softN += row.distanceMeters
  }
  if (softN > 0) {
    const softNorm = ((soft / softN + 1.2) / 2.4) * 100
    score = Math.round(score * 0.88 + softNorm * 0.12)
  }

  score = Math.max(0, Math.min(100, score))

  if (score < PROFILE_MIN_SCORE) {
    notes.unshift(
      `Mejor candidata para ${modality.label}: ${score}/100 (óptima ≥${PROFILE_MIN_SCORE}%).`,
    )
  } else if (!notes.some((n) => n.includes('sólidos') || n.includes('Pavimento') || n.includes('Mezcla'))) {
    notes.unshift(`Óptima para ${modality.label}: ${score}/100.`)
  }

  return { score, label: labelFromScore(score), notes, bikeType }
}

function waytypeIdFromLabel(label: string): number | undefined {
  const map: Record<string, number> = {
    Desconocido: 0,
    'Vía principal': 1,
    Carretera: 2,
    Calle: 3,
    Sendero: 4,
    Pista: 5,
    'Carril bici': 6,
    Peatonal: 7,
    Escaleras: 8,
    Ferry: 9,
    Obras: 10,
  }
  return map[label]
}

export function buildOrsOptionsFromStrategy(
  strategyIn: RoutingStrategy,
  routeType: 'a_to_b' | 'out_and_back' | 'circular' | 'map_trace',
  circularDistanceMeters?: number,
  circularSeed?: number,
): Record<string, unknown> {
  const profile_params: Record<string, unknown> = {}
  if (Object.keys(strategyIn.weightings).length) {
    profile_params.weightings = strategyIn.weightings
  }
  const options: Record<string, unknown> = {
    avoid_features: strategyIn.avoidFeatures,
    profile_params: Object.keys(profile_params).length ? profile_params : undefined,
  }
  // map_trace uses the same point-to-point engine as a_to_b (no round_trip).
  if (routeType === 'circular' && circularDistanceMeters) {
    options.round_trip = {
      length: Math.round(circularDistanceMeters),
      points: 5,
      ...(circularSeed !== undefined ? { seed: circularSeed } : {}),
    }
  }
  return options
}
