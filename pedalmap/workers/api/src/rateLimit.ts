/**
 * Rate Limiting Strategy (Current Implementation)
 *
 * PRIMARY: Cloudflare Cache API (per-datacenter, free tier)
 * FALLBACK: In-memory Map (per-isolate, ephemeral)
 *
 * GUARANTEES:
 * - Cache API working: Rate limit enforced per datacenter/region
 * - Cache API fails: Falls back to memory (per-isolate, resets on cold start)
 * - Fail-closed: If memory also fails, denies request (protects upstream APIs)
 *
 * LIMITATIONS:
 * - Cache API is NOT global: different datacenters have independent counters
 * - Memory fallback is per-isolate: multiple isolates = separate counters
 * - Total requests can exceed limit due to distribution across datacenters
 * - Not suitable for strict global limits (would need Workers KV/Durable Objects)
 *
 * ACTUAL BEHAVIOR:
 * - User in EU hits EU datacenter: counted separately from US requests
 * - Multiple concurrent Workers isolates: each has own memory fallback
 * - Effective limit is APPROXIMATE, distributed across infrastructure
 *
 * CURRENT USAGE:
 * - ORS routing: ~40 req/min per datacenter (adequate for free tier protection)
 * - Valhalla: ~30-60 req/min per datacenter
 * - Goal: Prevent single user from burning entire daily quota
 * - NOT suitable for billing enforcement or strict global rate limits
 */

import { json } from './types'

/** Isolate-local fallback when Cache API is unavailable (fail-closed). */
const memoryBuckets = new Map<string, { count: number; expiresAt: number }>()

/**
 * Memory-based rate limit bump (fallback only).
 * Returns true if request allowed, false if rate limited.
 */
function memoryBump(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now()
  const hit = memoryBuckets.get(key)
  if (!hit || hit.expiresAt <= now) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + windowSec * 1000 })
    return true
  }
  if (hit.count >= limit) return false
  hit.count += 1
  return true
}

function limitedResponse(windowSec: number): Response {
  return json(
    {
      error: 'Too many requests',
      code: 'rate_limited',
      retryAfterSec: windowSec,
    },
    429,
    { 'Retry-After': String(windowSec) },
  )
}

/** Simple per-isolate + Cache API rate limit (Workers free, no KV required). */
/**
 * Enforce rate limit using Cache API with memory fallback.
 *
 * @param request - Incoming request (used to extract IP if key not provided)
 * @param opts.limit - Max requests per window
 * @param opts.windowSec - Time window in seconds
 * @param opts.prefix - Rate limit bucket prefix (e.g., 'ors', 'valhalla')
 * @param opts.key - Optional explicit key (e.g., userId). If not provided, uses IP.
 *
 * @returns Response with 429 if rate limited, null if allowed
 */
export async function enforceRateLimit(
  request: Request,
  opts: { limit: number; windowSec: number; prefix: string; key?: string },
): Promise<Response | null> {
  const id =
    opts.key ||
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for') ||
    'unknown'
  const bucket = Math.floor(Date.now() / (opts.windowSec * 1000))
  const memKey = `${opts.prefix}:${id}:${bucket}`
  const cacheKey = new Request(
    `https://pedalmap-rl.internal/${opts.prefix}/${encodeURIComponent(id)}/${bucket}`,
  )

  // Always bump the in-memory counter first so concurrent requests in the same
  // isolate cannot all read the same Cache API value before any write lands.
  if (!memoryBump(memKey, opts.limit, opts.windowSec)) {
    return limitedResponse(opts.windowSec)
  }

  try {
    const cache = caches.default
    const hit = await cache.match(cacheKey)
    let count = Number((hit && (await hit.text())) || 0) || 0
    if (count >= opts.limit) {
      return limitedResponse(opts.windowSec)
    }
    count += 1
    await cache.put(
      cacheKey,
      new Response(String(count), {
        headers: {
          'Cache-Control': `max-age=${opts.windowSec}`,
          'Content-Type': 'text/plain',
        },
      }),
    )
  } catch (error) {
    // Memory bucket already enforced above — Cache sync is best-effort.
    console.warn('[rateLimit] cache sync failed', error)
  }
  return null
}
