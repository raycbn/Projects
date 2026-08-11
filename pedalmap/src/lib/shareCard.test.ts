import { describe, expect, it } from 'vitest'
import { buildRouteShareText } from '@/lib/shareCard'
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
    expect(text).toContain('Daganzo loop')
    expect(text).toMatch(/Ábrela en PedalMap/)
  })
})
