import { json } from './types'

/** Isolate-local fallback when Cache API is unavailable (fail-closed). */
const memoryBuckets = new Map<string, { count: number; expiresAt: number }>()

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

  try {
    const cache = caches.default
    const hit = await cache.match(cacheKey)
    let count = 0
    if (hit) {
      count = Number(await hit.text()) || 0
    }
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
    // Fail closed via in-memory counter so Cache API outages don't burn upstream quota.
    console.warn('[rateLimit] cache failed — using memory bucket', error)
    if (!memoryBump(memKey, opts.limit, opts.windowSec)) {
      return limitedResponse(opts.windowSec)
    }
  }
  return null
}
