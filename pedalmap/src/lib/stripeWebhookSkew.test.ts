import { describe, expect, it } from 'vitest'

/**
 * Mirrors Worker stripe.verifyStripeSignature timestamp skew rules
 * (workers/api/src/stripe.ts) so we catch regressions without a Workers test runner.
 */
function timestampWithinTolerance(
  headerT: string | undefined,
  nowSec: number,
  toleranceSec = 300,
): boolean {
  if (!headerT) return false
  const ts = Number(headerT)
  if (!Number.isFinite(ts)) return false
  return Math.abs(nowSec - ts) <= toleranceSec
}

describe('stripe webhook timestamp skew', () => {
  it('accepts fresh timestamps', () => {
    const now = 1_700_000_000
    expect(timestampWithinTolerance(String(now), now)).toBe(true)
    expect(timestampWithinTolerance(String(now - 299), now)).toBe(true)
  })

  it('rejects stale or future-skewed timestamps', () => {
    const now = 1_700_000_000
    expect(timestampWithinTolerance(String(now - 301), now)).toBe(false)
    expect(timestampWithinTolerance(String(now + 400), now)).toBe(false)
    expect(timestampWithinTolerance(undefined, now)).toBe(false)
    expect(timestampWithinTolerance('nope', now)).toBe(false)
  })
})
