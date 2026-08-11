import { Link } from 'react-router-dom'
import type { WindAlertCandidate } from '@/lib/windAlerts'
import { stashReadyRoute } from '@/lib/readyRouteHandoff'
import type { SavedRoute } from '@/domain/types'

interface WindAlertBannerProps {
  alert: WindAlertCandidate
  route?: SavedRoute
  onDismiss: () => void
}

/** Soft, low-clutter cue when an opted-in route has an excellent window soon. */
export function WindAlertBanner({ alert, route, onDismiss }: WindAlertBannerProps) {
  return (
    <div
      className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-[1.25rem] bg-[color-mix(in_oklab,var(--color-mist)_70%,white)] px-4 py-3"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-trail)]">
          Mejor ventana
        </p>
        <p className="mt-1 font-display text-base font-bold text-[var(--color-forest)]">
          {alert.routeTitle}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-stone)]">
          {alert.caption}
          {alert.score != null ? ` · ${alert.score}/100` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to={`/ruta?routeId=${alert.routeId}`}
          className="text-sm font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
          onClick={() => {
            if (route) {
              stashReadyRoute({
                draft: route,
                savedRouteId: route.id,
                shareSlug: route.shareSlug,
              })
            }
          }}
        >
          Abrir
        </Link>
        <button
          type="button"
          className="text-sm text-[var(--color-stone)] underline-offset-2 hover:underline"
          onClick={onDismiss}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
