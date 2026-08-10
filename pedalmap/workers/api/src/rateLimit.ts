import { json } from './types'

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
      return json(
        {
          error: 'Too many requests',
          code: 'rate_limited',
          retryAfterSec: opts.windowSec,
        },
        429,
        { 'Retry-After': String(opts.windowSec) },
      )
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
    // If Cache API fails, fail open (still serve) but log.
    console.warn('[rateLimit]', error)
  }
  return null
}
