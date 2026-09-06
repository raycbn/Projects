/**
 * DEV-ONLY test fixture. Not shipped to / displayed in production: the
 * `/dev/demo` route that consumes it is gated behind `import.meta.env.DEV`,
 * and this module is only imported by that route + its tests.
 *
 * Its purpose: let QA land an equivalent ReadyRoute state — with a real
 * geometry + stats + a temperature — so the PedalMap -> Fuel embedded flow
 * (CTA -> /fuel -> RouteContext prefill) can be exercised end-to-end on the
 * emulator / dev server WITHOUT a real account or a hand-drawn route.
 */
import type { RouteDraft } from '@/domain/types'
import type { ReadyRoutePacket } from '@/lib/readyRouteHandoff'

// Short out-and-back around Madrid (small but valid LineString).
// coordinates are [lng, lat] (GeoJSON / MapLibre convention).
const MADRID_RING: [number, number][] = [
  [-3.703790, 40.416775],
  [-3.687054, 40.421126],
  [-3.688075, 40.408735],
  [-3.703790, 40.416775],
]

export const DEV_ROUTE_CONTEXT = {
  distanceKm: 5.2,
  durationMinutes: 18,
  elevationGainM: 120,
  temperatureC: 22,
} as const

export const DEV_DRAFT: RouteDraft = {
  title: 'Ruta DEV - test (no producción)',
  description: 'Fixture de desarrollo para validar el flujo PedalMap → Fuel.',
  type: 'circular',
  bikeType: 'road',
  preferences: [],
  waypoints: [
    { id: 'w0', name: 'Origen DEV', position: { lat: 40.416775, lng: -3.70379 }, order: 0, kind: 'start' },
  ],
  geometry: { type: 'LineString', coordinates: MADRID_RING },
  elevationProfile: [
    { distanceMeters: 0, elevationMeters: 620 },
    { distanceMeters: 1300, elevationMeters: 650 },
    { distanceMeters: 2600, elevationMeters: 700 },
    { distanceMeters: 3900, elevationMeters: 690 },
    { distanceMeters: 5200, elevationMeters: 620 },
  ] as Array<{ distanceMeters: number; elevationMeters: number }>,
  stats: {
    distanceMeters: DEV_ROUTE_CONTEXT.distanceKm * 1000,
    elevationGainMeters: DEV_ROUTE_CONTEXT.elevationGainM,
    elevationLossMeters: 90,
    estimatedDurationSeconds: DEV_ROUTE_CONTEXT.durationMinutes * 60,
    difficulty: 'easy',
  },
}

export const DEV_READY_ROUTE_PACKET: ReadyRoutePacket = {
  draft: DEV_DRAFT,
  source: 'calculate',
  savedRouteId: null,
  shareSlug: null,
  isPublic: false,
}
