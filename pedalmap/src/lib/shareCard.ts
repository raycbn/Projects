import type { BikeType, RouteDraft, RouteStats } from '@/domain/types'
import { formatDistance, formatDuration, formatElevation } from '@/lib/stats'

/**
 * Render a square share card (PNG) for WhatsApp / native share.
 */
export async function renderRouteShareCard(draft: RouteDraft, shareUrl?: string): Promise<Blob> {
  const size = 1080
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')

  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#0b241c')
  grad.addColorStop(0.55, '#0d3b2b')
  grad.addColorStop(1, '#167a52')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  const blobGrad = ctx.createRadialGradient(820, 180, 20, 820, 180, 320)
  blobGrad.addColorStop(0, 'rgba(214,255,75,0.35)')
  blobGrad.addColorStop(1, 'rgba(214,255,75,0)')
  ctx.fillStyle = blobGrad
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#d6ff4b'
  ctx.font = '700 42px Syne, DM Sans, sans-serif'
  ctx.fillText('PedalMap', 72, 110)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 64px Syne, DM Sans, sans-serif'
  const title = truncate(draft.title || 'Mi ruta', 28)
  wrapText(ctx, title, 72, 220, size - 144, 72)

  const stats = draft.stats
  const rows: Array<[string, string]> = [
    ['Distancia', formatDistance(stats.distanceMeters)],
    ['Desnivel +', formatElevation(stats.elevationGainMeters)],
    ['Tiempo', formatMinutes(stats.estimatedDurationSeconds)],
  ]
  if (stats.surfaceStats?.suitability) {
    rows.push(['Idoneidad', `${stats.surfaceStats.suitability.score}% · ${bikeLabel(draft.bikeType)}`])
  } else {
    rows.push(['Bici', bikeLabel(draft.bikeType)])
  }

  let y = 420
  for (const [label, value] of rows) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '600 28px DM Sans, sans-serif'
    ctx.fillText(label.toUpperCase(), 72, y)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 52px Syne, DM Sans, sans-serif'
    ctx.fillText(value, 72, y + 58)
    y += 130
  }

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '500 24px DM Sans, sans-serif'
  const footer =
    shareUrl?.replace(/^https?:\/\//, '') ||
    (typeof window !== 'undefined' ? window.location.host : 'pedalmap.es')
  ctx.fillText(truncate(footer, 48), 72, size - 110)
  ctx.fillStyle = 'rgba(214,255,75,0.85)'
  ctx.font = '600 22px DM Sans, sans-serif'
  ctx.fillText('Hecha con PedalMap · pedalmap.es', 72, size - 64)

  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png')
  })
}

/** WhatsApp often drops `url` when files are attached — keep the link inside `text`. */
export function withShareUtm(url: string, medium = 'whatsapp'): string {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://pedalmap.es')
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'share')
    u.searchParams.set('utm_medium', medium)
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', 'route_card')
    return u.toString()
  } catch {
    return url
  }
}

export function buildRouteShareText(draft: RouteDraft, url: string): string {
  const shareUrl = withShareUtm(url)
  const lines = [
    draft.title || 'Ruta PedalMap',
    `${formatDistance(draft.stats.distanceMeters)} · ${formatElevation(draft.stats.elevationGainMeters)} · ${formatMinutes(draft.stats.estimatedDurationSeconds)} · ${bikeLabel(draft.bikeType)}`,
    '',
    'Hecha con PedalMap · Hecho en España',
    'Ábrela (mapa, desnivel y viento):',
    shareUrl,
    '',
    'Crea la tuya gratis → pedalmap.es',
  ]
  return lines.join('\n')
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/**
 * Call synchronously from a click handler (before any await). After async publish,
 * browsers block window.open — navigating this placeholder still works.
 * Do not pass `noopener` here: Chrome then returns null and we cannot set location.
 */
export function openWhatsAppPlaceholder(): Window | null {
  try {
    return window.open('about:blank', 'pedalmap_wa')
  } catch {
    return null
  }
}

export function closeWhatsAppPlaceholder(waWindow: Window | null | undefined): void {
  if (!waWindow || waWindow.closed) return
  try {
    waWindow.close()
  } catch {
    /* ignore */
  }
}

function navigateWhatsAppWindow(waWindow: Window | null | undefined, waUrl: string): boolean {
  if (waWindow && !waWindow.closed) {
    try {
      waWindow.location.href = waUrl
      return true
    } catch {
      closeWhatsAppPlaceholder(waWindow)
    }
  }
  try {
    // Named target reuses the placeholder tab when the handle was lost.
    const popup = window.open(waUrl, 'pedalmap_wa')
    return Boolean(popup)
  } catch {
    return false
  }
}

export type ShareCardOptions = {
  /** Window opened via openWhatsAppPlaceholder() in the same click turn. */
  waWindow?: Window | null
}

/**
 * After an async Firestore publish, the browser user-gesture is usually gone and
 * `navigator.share` can hang or no-op on mobile. Prefer clipboard + WhatsApp popup
 * without navigating this tab away.
 */
export async function shareRouteCard(
  draft: RouteDraft,
  url: string,
  options?: ShareCardOptions,
): Promise<'whatsapp' | 'shared' | 'copied' | 'downloaded'> {
  if (!url.includes('/route/')) {
    throw new Error('Se necesita un enlace público /route/… para compartir la ruta')
  }

  const text = buildRouteShareText(draft, url)
  const waUrl = buildWhatsAppShareUrl(text)

  // 1) Clipboard first so the user always keeps the link in PedalMap.
  let copied = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      copied = true
    }
  } catch {
    // ignore
  }

  // 2) Open WhatsApp — prefer the pre-opened placeholder from the click gesture.
  const openedWhatsApp = navigateWhatsAppWindow(options?.waWindow, waUrl)

  // 3) Optional card download in the background (don't block WhatsApp).
  void renderRouteShareCard(draft, url)
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = 'pedalmap-ruta.png'
      a.rel = 'noopener'
      // Soft download — some mobile browsers ignore this without gesture.
      a.click()
      URL.revokeObjectURL(objectUrl)
    })
    .catch(() => undefined)

  if (openedWhatsApp) return 'whatsapp'
  if (copied) return 'copied'
  return 'downloaded'
}

function bikeLabel(bike: BikeType): string {
  switch (bike) {
    case 'road':
      return 'Carretera'
    case 'mtb':
      return 'MTB'
    case 'gravel':
      return 'Gravel'
    case 'urban':
      return 'Urbana'
    case 'ebike':
      return 'E-bike'
    default:
      return bike
  }
}

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${String(m % 60).padStart(2, '0')} min`
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

function breakToken(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  const parts: string[] = []
  let buf = ''
  for (const ch of word) {
    const test = buf + ch
    if (buf && ctx.measureText(test).width > maxWidth) {
      parts.push(buf)
      buf = ch
    } else {
      buf = test
    }
  }
  if (buf) parts.push(buf)
  return parts.length ? parts : [word]
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/)
  let line = ''
  let yy = y
  const flushWord = (word: string) => {
    if (ctx.measureText(word).width <= maxWidth) {
      line = word
      return
    }
    const parts = breakToken(ctx, word, maxWidth)
    for (let i = 0; i < parts.length - 1; i += 1) {
      ctx.fillText(parts[i]!, x, yy)
      yy += lineHeight
    }
    line = parts[parts.length - 1] ?? ''
  }
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      yy += lineHeight
      flushWord(word)
    } else if (ctx.measureText(test).width > maxWidth) {
      flushWord(word)
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

export type LonLat = [number, number]

/** Keep the first/last vertex; thin the rest so canvas stays snappy. */
export function downsampleLonLat(coords: LonLat[], maxPoints = 360): LonLat[] {
  if (coords.length <= maxPoints) return coords
  const step = (coords.length - 1) / (maxPoints - 1)
  const out: LonLat[] = []
  for (let i = 0; i < maxPoints - 1; i += 1) {
    out.push(coords[Math.round(i * step)]!)
  }
  out.push(coords[coords.length - 1]!)
  return out
}

/**
 * Project [lng, lat] into a pixel box without stretching (cos-lat correction).
 * Y grows downward. Empty / invalid input → [].
 */
export function fitRouteSilhouette(
  coords: LonLat[],
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number }[] {
  const pts = downsampleLonLat(coords.filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1])))
  if (pts.length < 2) return []
  let minLon = pts[0]![0]
  let maxLon = minLon
  let minLat = pts[0]![1]
  let maxLat = minLat
  for (const [lon, lat] of pts) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180)
  const lonScale = Math.max(Math.cos(midLat), 0.2)
  const geoW = Math.max((maxLon - minLon) * lonScale, 1e-6)
  const geoH = Math.max(maxLat - minLat, 1e-6)
  const pad = 0.1
  const innerW = box.w * (1 - pad * 2)
  const innerH = box.h * (1 - pad * 2)
  const scale = Math.min(innerW / geoW, innerH / geoH)
  const drawW = geoW * scale
  const drawH = geoH * scale
  const ox = box.x + (box.w - drawW) / 2
  const oy = box.y + (box.h - drawH) / 2
  return pts.map(([lon, lat]) => ({
    x: ox + (lon - minLon) * lonScale * scale,
    y: oy + (maxLat - lat) * scale,
  }))
}

/** Host + path only — UTM stays on the clipboard, not painted on the Story. */
export function displayShareUrl(url: string): string {
  try {
    const u = new URL(url, 'https://pedalmap.es')
    return `${u.host}${u.pathname}`.replace(/\/$/, '')
  } catch {
    return url.replace(/^https?:\/\//, '').split('?')[0] ?? url
  }
}

/** 9:16 Instagram Story card: silhouette + stats + URL printed on the image. */
export async function renderRouteStoryCard(draft: RouteDraft, shareUrl: string): Promise<Blob> {
  const w = 1080
  const h = 1920
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')

  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#0b241c')
  bg.addColorStop(0.55, '#0d3b2b')
  bg.addColorStop(1, '#145c40')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const glow = ctx.createRadialGradient(w * 0.5, 520, 40, w * 0.5, 720, 620)
  glow.addColorStop(0, 'rgba(214,255,75,0.22)')
  glow.addColorStop(1, 'rgba(214,255,75,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#d6ff4b'
  ctx.font = '700 40px Syne, DM Sans, sans-serif'
  ctx.fillText('PedalMap', 72, 140)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 56px Syne, DM Sans, sans-serif'
  wrapText(ctx, truncate(draft.title || 'Mi ruta', 32), 72, 220, w - 144, 64)

  const box = { x: 48, y: 340, w: w - 96, h: 780 }
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(box.x, box.y, box.w, box.h, 36)
    ctx.fill()
  } else {
    ctx.fillRect(box.x, box.y, box.w, box.h)
  }

  const coords = (draft.geometry?.coordinates ?? []) as LonLat[]
  const silhouette = fitRouteSilhouette(coords, box)
  if (silhouette.length >= 2) {
    ctx.strokeStyle = '#d6ff4b'
    ctx.lineWidth = 10
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(silhouette[0]!.x, silhouette[0]!.y)
    for (let i = 1; i < silhouette.length; i += 1) {
      ctx.lineTo(silhouette[i]!.x, silhouette[i]!.y)
    }
    ctx.stroke()
    const start = silhouette[0]!
    const end = silhouette[silhouette.length - 1]!
    ctx.fillStyle = '#d6ff4b'
    ctx.beginPath()
    ctx.arc(start.x, start.y, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(end.x, end.y, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0d3b2b'
    ctx.lineWidth = 4
    ctx.stroke()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '600 28px DM Sans, sans-serif'
    ctx.fillText('Silueta no disponible', box.x + 48, box.y + box.h / 2)
  }

  const stats = [
    ['Distancia', formatDistance(draft.stats.distanceMeters)],
    ['Desnivel +', formatElevation(draft.stats.elevationGainMeters)],
    ['Tiempo', formatMinutes(draft.stats.estimatedDurationSeconds)],
  ]
  let sx = 72
  const sy = 1220
  for (const [label, value] of stats) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '600 22px DM Sans, sans-serif'
    ctx.fillText(label.toUpperCase(), sx, sy)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 42px Syne, DM Sans, sans-serif'
    ctx.fillText(value, sx, sy + 52)
    sx += 330
  }

  ctx.fillStyle = '#d6ff4b'
  ctx.font = '700 28px DM Sans, sans-serif'
  ctx.fillText(bikeLabel(draft.bikeType), 72, 1360)

  const printed = displayShareUrl(withShareUtm(shareUrl, 'instagram'))
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 22px DM Sans, sans-serif'
  ctx.fillText('ENLACE (pégalo en la pegatina)', 72, 1480)
  ctx.fillStyle = '#d6ff4b'
  ctx.font = '700 28px Syne, DM Sans, sans-serif'
  wrapText(ctx, printed, 72, 1530, w - 144, 36)

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '500 22px DM Sans, sans-serif'
  ctx.fillText('Hecha con PedalMap · pedalmap.es', 72, 1840)

  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la Story'))), 'image/png')
  })
}

export async function shareRouteStory(
  draft: RouteDraft,
  url: string,
): Promise<'shared' | 'downloaded'> {
  if (!url.includes('/route/')) {
    throw new Error('Se necesita un enlace público /route/… para la Story')
  }
  const shareUrl = withShareUtm(url, 'instagram')
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl)
    }
  } catch {
    /* ignore */
  }

  const blob = await renderRouteStoryCard(draft, url)
  const file = new File([blob], 'pedalmap-story.png', { type: 'image/png' })

  try {
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: draft.title || 'Ruta PedalMap',
        text: shareUrl,
      })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'downloaded'
  }

  await downloadShareCardPng(blob, 'pedalmap-story.png')
  try {
    window.open('https://www.instagram.com/', '_blank', 'noopener')
  } catch {
    /* ignore */
  }
  return 'downloaded'
}

export function suitabilityLine(stats: RouteStats): string | null {
  const s = stats.surfaceStats?.suitability
  if (!s) return null
  return `${s.score}% ${s.label}`
}

export type ActivityShareInput = {
  title: string
  distanceMeters: number
  elevationGainMeters: number
  durationSeconds: number
  bikeType?: BikeType
}

/** Square PNG card for post-ride WhatsApp share. */
export async function renderActivityShareCard(
  activity: ActivityShareInput,
  shareUrl?: string,
): Promise<Blob> {
  const draftLike: RouteDraft = {
    title: activity.title,
    type: 'a_to_b',
    bikeType: activity.bikeType ?? 'road',
    preferences: [],
    waypoints: [],
    geometry: { type: 'LineString', coordinates: [] },
    elevationProfile: [],
    stats: {
      distanceMeters: activity.distanceMeters,
      elevationGainMeters: activity.elevationGainMeters,
      elevationLossMeters: 0,
      estimatedDurationSeconds: activity.durationSeconds,
      difficulty: 'moderate',
    },
  }
  return renderRouteShareCard(draftLike, shareUrl)
}

export function buildActivityShareText(activity: ActivityShareInput, url?: string): string {
  const lines = [
    activity.title || 'Salida PedalMap',
    `${formatDistance(activity.distanceMeters)} · ${formatElevation(activity.elevationGainMeters)} · ${formatDuration(activity.durationSeconds)}`,
    '',
    'Análisis Free en PedalMap · Hecho en España',
  ]
  if (url) {
    lines.push(withShareUtm(url))
  }
  lines.push('', 'Crea tu próxima ruta gratis → pedalmap.es')
  return lines.join('\n')
}

/** Download the PNG card for Instagram Stories / feed (no IG Graph API in-app). */
export async function downloadShareCardPng(
  blob: Blob,
  filename = 'pedalmap-tarjeta.png',
): Promise<void> {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(objectUrl)
}

export async function shareActivityCard(
  activity: ActivityShareInput,
  url?: string,
  options?: ShareCardOptions & { alsoInstagram?: boolean },
): Promise<'whatsapp' | 'shared' | 'copied' | 'downloaded'> {
  const text = buildActivityShareText(activity, url)
  const waUrl = buildWhatsAppShareUrl(text)

  let copied = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      copied = true
    }
  } catch {
    /* ignore */
  }

  const openedWhatsApp = navigateWhatsAppWindow(options?.waWindow, waUrl)

  void renderActivityShareCard(activity, url)
    .then(async (blob) => {
      await downloadShareCardPng(blob, 'pedalmap-salida.png')
      if (options?.alsoInstagram) {
        // Soft open Instagram — user attaches the downloaded card.
        try {
          window.open('https://www.instagram.com/', '_blank', 'noopener')
        } catch {
          /* ignore */
        }
      }
    })
    .catch(() => undefined)

  if (openedWhatsApp) return 'whatsapp'
  if (copied) return 'copied'
  return 'downloaded'
}
