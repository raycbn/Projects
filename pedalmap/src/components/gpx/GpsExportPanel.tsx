import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { RouteDraft } from '@/domain/types'
import { exportRouteToGpx } from '@/lib/gpx'
import { track } from '@/lib/analytics'
import { canExportGpx, freeGpxRemaining } from '@/services/EntitlementService'
import { fetchServerEntitlements } from '@/lib/planSync'
import { useAuth } from '@/app/AuthContext'
import { authService } from '@/services/AuthService'
import { consumeGuestGpx } from '@/lib/freemium'

interface GpsExportPanelProps {
  route: RouteDraft
  onPremiumRequired?: () => void
}

/** Free / freemium bike GPS apps we can hand a GPX to via share or download. */
const FREE_GPS_APPS = [
  {
    id: 'osmand',
    name: 'OsmAnd',
    blurb: 'Mapas offline y navegación. Abre el GPX con “Abrir con…”.',
    url: 'https://osmand.net/',
  },
  {
    id: 'organic',
    name: 'Organic Maps',
    blurb: 'Offline, sin tracking. Importa el GPX desde archivos.',
    url: 'https://organicmaps.app/',
  },
  {
    id: 'gpxsee',
    name: 'GPXSee / visor GPX',
    blurb: 'Ideal para revisar el track antes de cargarlo al GPS.',
    url: 'https://www.gpxsee.org/',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    blurb: 'Gratis: sube el GPX en la web/app y sincroniza al ciclocomputador.',
    url: 'https://connect.garmin.com/',
  },
  {
    id: 'wahoo',
    name: 'Wahoo',
    blurb: 'Importa rutas GPX en la app Wahoo y envíalas al ELEMNT.',
    url: 'https://www.wahoofitness.com/',
  },
] as const

function gpxFileName(route: RouteDraft): string {
  return `${route.title.replace(/\s+/g, '-').toLowerCase() || 'ruta'}.gpx`
}

function buildGpxFile(route: RouteDraft): { file: File; blob: Blob } {
  const xml = exportRouteToGpx(route)
  const blob = new Blob([xml], { type: 'application/gpx+xml' })
  const file = new File([blob], gpxFileName(route), { type: 'application/gpx+xml' })
  return { file, blob }
}

function downloadGpx(route: RouteDraft) {
  const { blob } = buildGpxFile(route)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = gpxFileName(route)
  a.click()
  URL.revokeObjectURL(url)
}

export function GpsExportPanel({ route, onPremiumRequired }: GpsExportPanelProps) {
  const { profile } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  const canShareFiles = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
  }, [])

  async function ensureExportAllowed(): Promise<boolean> {
    // Soft Free trial is client-side; Premium is unlimited.
    if (!canExportGpx(profile)) {
      onPremiumRequired?.()
      return false
    }
    // Server is source of truth for Premium; Free trial stays local even if server says no GPX.
    if (profile?.plan === 'premium') {
      const server = await fetchServerEntitlements()
      if (server && !server.gpxExport) {
        onPremiumRequired?.()
        return false
      }
    }
    return true
  }

  async function noteFreeTrialUsed() {
    if (profile?.plan === 'premium') return
    if (profile) {
      try {
        await authService.recordFreeGpxExport(profile.uid)
        track('free_trial_used', { kind: 'gpx' })
      } catch (err) {
        console.warn('[gpx] free trial', err)
      }
      return
    }
    consumeGuestGpx()
    track('free_trial_used', { kind: 'gpx', guest: true })
  }

  async function download() {
    if (!(await ensureExportAllowed())) return
    downloadGpx(route)
    await noteFreeTrialUsed()
    track('gpx_exported', { distance_m: route.stats.distanceMeters, method: 'download' })
    setMessage(
      profile?.plan === 'premium'
        ? 'GPX descargado. Ábrelo con OsmAnd, Organic Maps, Garmin Connect o Wahoo.'
        : 'GPX descargado · prueba Free de esta semana.',
    )
  }

  async function shareToApps() {
    if (!(await ensureExportAllowed())) return
    const { file } = buildGpxFile(route)
    try {
      if (canShareFiles && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: route.title,
          text: 'Ruta PedalMap (GPX)',
        })
        await noteFreeTrialUsed()
        track('gpx_exported', { distance_m: route.stats.distanceMeters, method: 'share' })
        setMessage('Elige OsmAnd, Organic Maps, Garmin, Wahoo u otra app GPS en el menú compartir.')
        return
      }
      await download()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('[gpx share]', error)
      await download()
    }
  }

  const trialHint =
    profile?.plan === 'premium'
      ? null
      : freeGpxRemaining(profile) > 0
        ? `Free: ${freeGpxRemaining(profile)} GPX esta semana.`
        : 'Free: GPX de esta semana usado. Premium = ilimitado.'

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          Exportar a GPS
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-stone)]">
          GPX hacia OsmAnd, Organic Maps, Garmin o Wahoo.
        </p>
        {trialHint && (
          <p className="mt-2 text-[11px] text-[var(--color-trail)]">{trialHint}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void shareToApps()}>
          Enviar a app
        </Button>
        <Button variant="ghost" onClick={() => void download()}>
          Descargar GPX
        </Button>
      </div>

      {message && <p className="text-xs text-[var(--color-trail)]">{message}</p>}

      <ul className="space-y-1.5">
        {FREE_GPS_APPS.map((app) => (
          <li key={app.id} className="flex items-baseline justify-between gap-2 py-1">
            <div>
              <p className="text-sm font-medium text-[var(--color-forest)]">{app.name}</p>
              <p className="text-[11px] text-[var(--color-stone)]">{app.blurb}</p>
            </div>
            <a
              className="shrink-0 text-xs font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
              href={app.url}
              target="_blank"
              rel="noreferrer"
            >
              Web
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Compact download button used on My Routes / older call sites. */
export function GPXExporter({ route, onPremiumRequired }: GpsExportPanelProps) {
  const { profile } = useAuth()

  async function download() {
    if (!canExportGpx(profile)) {
      onPremiumRequired?.()
      return
    }
    if (profile?.plan === 'premium') {
      const server = await fetchServerEntitlements()
      if (server && !server.gpxExport) {
        onPremiumRequired?.()
        return
      }
    }
    downloadGpx(route)
    if (profile && profile.plan !== 'premium') {
      void authService.recordFreeGpxExport(profile.uid).catch(() => undefined)
      track('free_trial_used', { kind: 'gpx' })
    }
    track('gpx_exported', { distance_m: route.stats.distanceMeters, method: 'download' })
  }

  return (
    <Button variant="ghost" onClick={() => void download()}>
      Descargar GPX
    </Button>
  )
}
