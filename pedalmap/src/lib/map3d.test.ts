import { describe, expect, it } from 'vitest'
import { routeStartBearing } from './map3d'

describe('map3d', () => {
  it('computes bearing roughly north for northbound segment', () => {
    const bearing = routeStartBearing([
      [-3.7, 40.4],
      [-3.7, 40.5],
    ])
    const delta = Math.min(Math.abs(bearing - 0), Math.abs(bearing - 360))
    expect(delta).toBeLessThan(10)
  })

  it('computes bearing roughly east for eastbound segment', () => {
    const bearing = routeStartBearing([
      [-3.7, 40.4],
      [-3.5, 40.4],
    ])
    expect(bearing).toBeGreaterThan(80)
    expect(bearing).toBeLessThan(100)
  })
})
