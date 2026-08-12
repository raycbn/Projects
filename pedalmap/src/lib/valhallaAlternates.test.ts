import { describe, expect, it } from 'vitest'
import { unwrapValhallaAlternates } from './valhallaAlternates'

describe('unwrapValhallaAlternates', () => {
  it('unwraps { trip } wrappers from Valhalla', () => {
    const trips = unwrapValhallaAlternates([
      { trip: { legs: [{ shape: 'abc' }], summary: { length: 1 } } },
      { trip: { legs: [{ shape: 'def' }] } },
    ])
    expect(trips).toHaveLength(2)
    expect(trips[0].legs).toHaveLength(1)
  })

  it('accepts bare trips from some mirrors', () => {
    const trips = unwrapValhallaAlternates([{ legs: [{ shape: 'x' }] }])
    expect(trips).toHaveLength(1)
  })

  it('ignores junk', () => {
    expect(unwrapValhallaAlternates(null)).toEqual([])
    expect(unwrapValhallaAlternates([{ foo: 1 }])).toEqual([])
  })
})
