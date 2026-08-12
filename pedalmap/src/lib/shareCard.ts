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
export function withShareUtm(url: string): string {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://pedalmap.es')
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'share')
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'whatsapp')
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
    'Hecha con PedalMap · ábrela (mapa, desnivel y viento):',
    shareUrl,
    '',
    'Crea la tuya gratis en pedalmap.es',
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
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
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
    'Análisis Free en PedalMap (movimiento, VAM, potencia estimada…).',
  ]
  if (url) {
    lines.push(withShareUtm(url))
  }
  lines.push('', 'Crea tu próxima ruta en pedalmap.es')
  return lines.join('\n')
}

export async function shareActivityCard(
  activity: ActivityShareInput,
  url?: string,
  options?: ShareCardOptions,
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
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = 'pedalmap-salida.png'
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(objectUrl)
    })
    .catch(() => undefined)

  if (openedWhatsApp) return 'whatsapp'
  if (copied) return 'copied'
  return 'downloaded'
}
