import { describe, expect, it } from 'vitest'
import {
  buildInstructionAtMeters,
  instructionStepFromDistance,
} from './gpsRouteHandoff'

describe('gpsRouteHandoff instruction distances', () => {
  it('spaces thresholds evenly along the route', () => {
    expect(buildInstructionAtMeters(['a', 'b', 'c'], 300)).toEqual([0, 100, 200])
  })

  it('advances step by distance, not progress*N jumps', () => {
    const thresholds = [0, 100, 200]
    expect(instructionStepFromDistance(0, thresholds)).toBe(0)
    expect(instructionStepFromDistance(99, thresholds)).toBe(0)
    expect(instructionStepFromDistance(100, thresholds)).toBe(1)
    expect(instructionStepFromDistance(250, thresholds)).toBe(2)
  })
})
