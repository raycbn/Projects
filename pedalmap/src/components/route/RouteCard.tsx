import { Link } from 'react-router-dom'
import type { SavedRoute } from '@/domain/types'
import { difficultyLabel, formatDistance, formatDuration, formatElevation } from '@/lib/stats'
import { Button } from '@/components/ui/Button'

interface RouteCardProps {
  route: SavedRoute
  onShare?: (route: SavedRoute) => void
  onDuplicate?: (route: SavedRoute) => void
  onDelete?: (route: SavedRoute) => void
  onExport?: (route: SavedRoute) => void
}

export function RouteCard({
  route,
  onShare,
  onDuplicate,
  onDelete,
  onExport,
}: RouteCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-white/80 p-4 ring-1 ring-[var(--color-fog)] transition hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <h3 className="font-display text-lg font-bold text-[var(--color-forest)]">{route.title}</h3>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          {formatDistance(route.stats.distanceMeters)} ·{' '}
          {formatElevation(route.stats.elevationGainMeters)} ·{' '}
          {formatDuration(route.stats.estimatedDurationSeconds)} ·{' '}
          {difficultyLabel(route.stats.difficulty)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/route-planner?routeId=${route.id}`}>
          <Button variant="secondary" className="!py-2">Ver</Button>
        </Link>
        <Link to={`/route-planner?routeId=${route.id}&edit=1`}>
          <Button variant="ghost" className="!py-2">Editar</Button>
        </Link>
        {onShare && (
          <Button variant="ghost" className="!py-2" onClick={() => onShare(route)}>
            Compartir
          </Button>
        )}
        {onDuplicate && (
          <Button variant="ghost" className="!py-2" onClick={() => onDuplicate(route)}>
            Duplicar
          </Button>
        )}
        {onExport && (
          <Button variant="ghost" className="!py-2" onClick={() => onExport(route)}>
            GPX
          </Button>
        )}
        {onDelete && (
          <Button variant="danger" className="!py-2" onClick={() => onDelete(route)}>
            Eliminar
          </Button>
        )}
      </div>
    </article>
  )
}
