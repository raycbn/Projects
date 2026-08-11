import type { BikeType, RouteDraft, RouteStats } from '@/domain/types'
import { formatDistance, formatElevation } from '@/lib/stats'

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

  // soft signal blob
  const blob = ctx.createRadialGradient(820, 180, 20, 820, 180, 320)
  blob.addColorStop(0, 'rgba(214,255,75,0.35)')
  blob.addColorStop(1, 'rgba(214,255,75,0)')
  ctx.fillStyle = blob
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
  ctx.fillText(truncate(footer, 48), 72, size - 72)

  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png')
  })
}

export async function shareRouteCard(draft: RouteDraft, url?: string): Promise<'shared' | 'copied' | 'downloaded'> {
  const blob = await renderRouteShareCard(draft, url)
  const file = new File([blob], 'pedalmap-ruta.png', { type: 'image/png' })
  const text = `${draft.title} · ${formatDistance(draft.stats.distanceMeters)} · ${formatElevation(draft.stats.elevationGainMeters)}${url ? `\n${url}` : ''}`

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: draft.title,
      text,
      url,
    })
    return 'shared'
  }

  // Fallback: download image + copy link
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = 'pedalmap-ruta.png'
  a.click()
  URL.revokeObjectURL(objectUrl)
  if (url && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
    return 'copied'
  }
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
