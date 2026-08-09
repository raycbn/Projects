import { describe, expect, it } from 'vitest'
import { exportRouteToGpx, parseGpx } from '@/lib/gpx'

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Demo GPX</name></metadata>
  <trk>
    <name>Demo GPX</name>
    <trkseg>
      <trkpt lat="40.4168" lon="-3.7038"><ele>650</ele><time>2024-01-01T10:00:00Z</time></trkpt>
      <trkpt lat="40.42" lon="-3.71"><ele>700</ele></trkpt>
      <trkpt lat="40.43" lon="-3.72"><ele>680</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('gpx', () => {
  it('parses track points, elevation and timestamps', () => {
    const imported = parseGpx(sample)
    expect(imported.name).toBe('Demo GPX')
    expect(imported.points).toHaveLength(3)
    expect(imported.points[0].elevationMeters).toBe(650)
    expect(imported.points[0].time).toBe('2024-01-01T10:00:00Z')
    expect(imported.geometry.coordinates).toHaveLength(3)
    expect(imported.distanceMeters).toBeGreaterThan(0)
  })

  it('exports a valid GPX string', () => {
    const imported = parseGpx(sample)
    const xml = exportRouteToGpx({
      title: imported.name,
      geometry: imported.geometry,
      elevationProfile: imported.elevationProfile,
    })
    expect(xml).toContain('<gpx')
    expect(xml).toContain('<trkpt')
    expect(xml).toContain('lat="40.4168"')
  })

  it('rejects invalid GPX', () => {
    expect(() => parseGpx('<not-gpx>')).toThrow()
  })
})
