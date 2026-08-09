import { Button } from '@/components/ui/Button'
import type { RouteDraft } from '@/domain/types'
import { exportRouteToGpx } from '@/lib/gpx'
import { track } from '@/lib/analytics'
import { canExportGpx } from '@/services/EntitlementService'
import { useAuth } from '@/app/AuthContext'

interface GPXExporterProps {
  route: RouteDraft
  onPremiumRequired?: () => void
}

export function GPXExporter({ route, onPremiumRequired }: GPXExporterProps) {
  const { profile } = useAuth()

  function download() {
    if (!canExportGpx(profile)) {
      onPremiumRequired?.()
      return
    }
    const xml = exportRouteToGpx(route)
    const blob = new Blob([xml], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${route.title.replace(/\s+/g, '-').toLowerCase() || 'ruta'}.gpx`
    a.click()
    URL.revokeObjectURL(url)
    track('gpx_exported', { distance_m: route.stats.distanceMeters })
  }

  return (
    <Button variant="ghost" onClick={download}>
      Descargar GPX
    </Button>
  )
}
