import { describe, expect, it } from 'vitest'
import { decodePolyline, encodePolyline } from '@/lib/valhallaPolyline'
import { getValhallaCosting } from '@/lib/bikeValhallaProfile'
import { surfaceStatsFromValhallaEdges } from '@/lib/valhallaSurfaces'

describe('valhallaPolyline', () => {
  it('round-trips coordinates at precision 6', () => {
    const input: [number, number][] = [
      [-3.7038, 40.4168],
      [-3.69, 40.42],
      [-3.6823, 40.4155],
    ]
    const encoded = encodePolyline(input)
    const decoded = decodePolyline(encoded)
    expect(decoded).toHaveLength(3)
    expect(decoded[0][0]).toBeCloseTo(input[0][0], 5)
    expect(decoded[0][1]).toBeCloseTo(input[0][1], 5)
    expect(decoded[2][0]).toBeCloseTo(input[2][0], 5)
  })
})

describe('bikeValhallaProfile', () => {
  it('maps road to strict surface avoidance', () => {
    const c = getValhallaCosting('road')
    expect(c.bicycle_type).toBe('Road')
    expect(c.avoid_bad_surfaces).toBe(1)
  })

  it('maps mtb to mountain with low surface avoidance', () => {
    const c = getValhallaCosting('mtb')
    expect(c.bicycle_type).toBe('Mountain')
    expect(c.avoid_bad_surfaces).toBeLessThan(0.2)
  })

  it('maps gravel to cross', () => {
    expect(getValhallaCosting('gravel').bicycle_type).toBe('Cross')
  })
})

describe('valhallaSurfaces', () => {
  it('scores mostly paved_smooth as excellent for road', () => {
    const stats = surfaceStatsFromValhallaEdges('road', [
      { length: 2.5, surface: 'paved_smooth', road_class: 'secondary', use: 'road' },
      { length: 0.1, surface: 'paved', road_class: 'residential', use: 'road' },
      { length: 0.05, surface: 'compacted', road_class: 'path', use: 'path' },
    ])
    expect(stats.pavedPercent ?? 0).toBeGreaterThan(90)
    expect(stats.suitability?.score ?? 0).toBeGreaterThanOrEqual(90)
  })

  it('scores dirt/path heavy as good for mtb', () => {
    const stats = surfaceStatsFromValhallaEdges('mtb', [
      { length: 2.0, surface: 'dirt', road_class: 'path', use: 'path' },
      { length: 1.0, surface: 'gravel', road_class: 'track', use: 'track' },
      { length: 0.3, surface: 'paved', road_class: 'residential', use: 'road' },
    ])
    expect(stats.unpavedPercent ?? 0).toBeGreaterThan(70)
    expect(stats.suitability?.score ?? 0).toBeGreaterThanOrEqual(75)
  })

  it('computes cycle network / infra share from bicycle_network + cycleway edges (free Strava-popularity stand-in)', () => {
    const stats = surfaceStatsFromValhallaEdges('road', [
      // Signed EuroVelo/Vías Verdes-style relation (lcn bit set).
      { length: 1.0, surface: 'paved', road_class: 'secondary', use: 'road', bicycle_network: 1 },
      // Dedicated cycleway, no signed network.
      { length: 1.0, surface: 'paved_smooth', road_class: 'cycleway', use: 'cycleway' },
      // Plain road, no cycle infra at all.
      { length: 2.0, surface: 'paved', road_class: 'residential', use: 'road' },
    ])
    expect(stats.cycleNetworkPercent ?? 0).toBeCloseTo(25, 0)
    expect(stats.cycleInfraPercent ?? 0).toBeCloseTo(50, 0)
  })

  it('reports zero cycle network / infra when there is none', () => {
    const stats = surfaceStatsFromValhallaEdges('road', [
      { length: 2.0, surface: 'paved', road_class: 'residential', use: 'road' },
    ])
    expect(stats.cycleNetworkPercent ?? 0).toBe(0)
    expect(stats.cycleInfraPercent ?? 0).toBe(0)
  })
})
