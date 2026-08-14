import { describe, expect, it } from 'vitest'
import {
  buildRouteShareText,
  buildWhatsAppShareUrl,
  displayShareUrl,
  downsampleLonLat,
  fitRouteSilhouette,
  withShareUtm,
} from '@/lib/shareCard'
import type { RouteDraft } from '@/domain/types'

describe('buildRouteShareText', () => {
  it('puts the public /route/ URL in the WhatsApp message body', () => {
    const draft = {
      title: 'Daganzo loop',
      bikeType: 'road',
      stats: {
        distanceMeters: 42500,
        elevationGainMeters: 380,
        elevationLossMeters: 380,
        estimatedDurationSeconds: 5400,
        difficulty: 'moderate',
      },
    } as RouteDraft
    const text = buildRouteShareText(draft, 'https://pedalmap.es/route/daganzo-abc123')
    expect(text).toContain('https://pedalmap.es/route/daganzo-abc123')
    expect(text).toContain('utm_source=share')
    expect(text).toContain('Daganzo loop')
    expect(text).toMatch(/Hecha con PedalMap/)
    expect(text).toMatch(/Crea la tuya gratis/)
    expect(buildWhatsAppShareUrl(text)).toContain('wa.me')
    expect(buildWhatsAppShareUrl(text)).toContain(
      encodeURIComponent('https://pedalmap.es/route/daganzo-abc123'),
    )
    expect(text).toContain('utm_medium=whatsapp')
  })
})

describe('withShareUtm', () => {
  it('keeps WhatsApp as the default medium and can stamp Instagram', () => {
    const wa = withShareUtm('https://pedalmap.es/route/abc')
    expect(wa).toContain('utm_source=share')
    expect(wa).toContain('utm_medium=whatsapp')
    const ig = withShareUtm('https://pedalmap.es/route/abc', 'instagram')
    expect(ig).toContain('utm_medium=instagram')
    expect(ig).toContain('utm_campaign=route_card')
  })
})

describe('displayShareUrl', () => {
  it('prints host + path without UTM so the Story card stays readable', () => {
    expect(
      displayShareUrl(
        'https://pedalmap.es/route/daganzo-abc123?utm_source=share&utm_medium=instagram',
      ),
    ).toBe('pedalmap.es/route/daganzo-abc123')
  })
})

describe('downsampleLonLat', () => {
  it('keeps the first and last vertex and thins the rest', () => {
    const coords = Array.from({ length: 1000 }, (_, i) => [i * 0.001, 40] as [number, number])
    const thinned = downsampleLonLat(coords, 40)
    expect(thinned).toHaveLength(40)
    expect(thinned[0]).toEqual(coords[0])
    expect(thinned[thinned.length - 1]).toEqual(coords[coords.length - 1])
  })
})

describe('fitRouteSilhouette', () => {
  const box = { x: 100, y: 200, w: 800, h: 600 }

  it('returns empty for fewer than two valid points', () => {
    expect(fitRouteSilhouette([], box)).toEqual([])
    expect(fitRouteSilhouette([[-3.7, 40.4]], box)).toEqual([])
  })

  it('maps east to larger X and north to smaller Y, without stretching', () => {
    // ~1° east, ~0.5° north from a Madrid-ish start (equirectangular + cos-lat).
    const start: [number, number] = [-3.7, 40.4]
    const east: [number, number] = [-2.7, 40.4]
    const north: [number, number] = [-3.7, 40.9]
    const pts = fitRouteSilhouette([start, east, north], box)
    expect(pts).toHaveLength(3)
    expect(pts[1]!.x).toBeGreaterThan(pts[0]!.x)
    expect(pts[1]!.y).toBeCloseTo(pts[0]!.y, 5)
    expect(pts[2]!.y).toBeLessThan(pts[0]!.y)
    expect(pts[2]!.x).toBeCloseTo(pts[0]!.x, 5)
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(box.x)
      expect(p.x).toBeLessThanOrEqual(box.x + box.w)
      expect(p.y).toBeGreaterThanOrEqual(box.y)
      expect(p.y).toBeLessThanOrEqual(box.y + box.h)
    }
  })
})
