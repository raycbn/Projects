import type { SavedRoute } from '@/domain/types'
import { RouteCard } from '@/components/route/RouteCard'

interface RouteListProps {
  routes: SavedRoute[]
  onShare?: (route: SavedRoute) => void
  onDuplicate?: (route: SavedRoute) => void
  onDelete?: (route: SavedRoute) => void
  onExport?: (route: SavedRoute) => void
  showWindAlertToggle?: boolean
  onToggleWindAlert?: (route: SavedRoute) => void
  windAlertBusyId?: string | null
}

export function RouteList({
  routes,
  showWindAlertToggle,
  onToggleWindAlert,
  windAlertBusyId,
  ...actions
}: RouteListProps) {
  if (!routes.length) {
    return (
      <div className="rounded-3xl border border-dashed border-[var(--color-fog)] bg-white/50 p-8 text-center">
        <p className="font-display text-xl text-[var(--color-forest)]">Aún no tienes rutas guardadas</p>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          Crea tu primera ruta y guárdala para consultarla aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {routes.map((route) => (
        <RouteCard
          key={route.id}
          route={route}
          {...actions}
          showWindAlertToggle={showWindAlertToggle}
          onToggleWindAlert={onToggleWindAlert}
          windAlertBusy={windAlertBusyId === route.id}
        />
      ))}
    </div>
  )
}
