import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SavedRoute } from '@/domain/types'
import { difficultyLabel, formatDistance, formatDuration, formatElevation } from '@/lib/stats'
import { Button } from '@/components/ui/Button'
import { stashReadyRoute } from '@/lib/readyRouteHandoff'

interface RouteCardProps {
  route: SavedRoute
  onShare?: (route: SavedRoute) => void
  onTogglePublic?: (route: SavedRoute) => void
  onDuplicate?: (route: SavedRoute) => void
  onDelete?: (route: SavedRoute) => void
  onExport?: (route: SavedRoute) => void
  /** Soft per-route wind-alert toggle (shown when master switch is on). */
  showWindAlertToggle?: boolean
  onToggleWindAlert?: (route: SavedRoute) => void
  windAlertBusy?: boolean
  visibilityBusy?: boolean
}

export function RouteCard({
  route,
  onShare,
  onTogglePublic,
  onDuplicate,
  onDelete,
  onExport,
  showWindAlertToggle,
  onToggleWindAlert,
  windAlertBusy,
  visibilityBusy,
}: RouteCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent | PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <article className="flex flex-col gap-3 rounded-[1.5rem] bg-white/70 p-4 ring-1 ring-[var(--color-fog)]/70 transition hover:bg-white/90">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[var(--color-forest)]">{route.title}</h3>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {formatDistance(route.stats.distanceMeters)} ·{' '}
            {formatElevation(route.stats.elevationGainMeters)} ·{' '}
            {formatDuration(route.stats.estimatedDurationSeconds)} ·{' '}
            {difficultyLabel(route.stats.difficulty)}
          </p>
          {route.bestWindWindow?.caption ? (
            <p className="mt-1.5 text-xs text-[var(--color-trail)]">
              Mejor salida · {route.bestWindWindow.caption}
              {route.bestWindWindow.score != null ? ` · ${route.bestWindWindow.score}/100` : ''}
            </p>
          ) : null}
          {route.isPublic ? (
            <p className="mt-1 text-xs font-medium text-[var(--color-trail)]">
              Pública · Explorar / perfil / Cheers
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-stone)]">Privada</p>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-lg font-bold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]"
            aria-label="Más acciones"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-[var(--color-fog)]">
              {onTogglePublic && (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-mist)]"
                  disabled={visibilityBusy}
                  onClick={() => {
                    setMenuOpen(false)
                    onTogglePublic(route)
                  }}
                >
                  {route.isPublic ? 'Hacer privada' : 'Hacer pública'}
                </button>
              )}
              {onShare && (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-mist)]"
                  onClick={() => {
                    setMenuOpen(false)
                    onShare(route)
                  }}
                >
                  Compartir
                </button>
              )}
              {onDuplicate && (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-mist)]"
                  onClick={() => {
                    setMenuOpen(false)
                    onDuplicate(route)
                  }}
                >
                  Duplicar
                </button>
              )}
              {onExport && (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-mist)]"
                  onClick={() => {
                    setMenuOpen(false)
                    onExport(route)
                  }}
                >
                  Exportar GPX
                </button>
              )}
              <Link
                to={`/route-planner?routeId=${route.id}&edit=1`}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-mist)]"
                onClick={() => setMenuOpen(false)}
              >
                Editar
              </Link>
              {onDelete && (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-[#fff4f4]"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete(route)
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={`/ruta?routeId=${route.id}`}
          onClick={() =>
            stashReadyRoute({
              draft: route,
              savedRouteId: route.id,
              shareSlug: route.shareSlug,
              isPublic: route.isPublic === true,
            })
          }
        >
          <Button variant="secondary" className="!py-2">
            Abrir
          </Button>
        </Link>
        {onTogglePublic ? (
          <button
            type="button"
            disabled={visibilityBusy}
            className={`text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50 ${
              route.isPublic ? 'text-[var(--color-trail)]' : 'text-[var(--color-stone)]'
            }`}
            onClick={() => onTogglePublic(route)}
          >
            {visibilityBusy ? '…' : route.isPublic ? 'Pública' : 'Hacer pública'}
          </button>
        ) : null}
        {showWindAlertToggle && onToggleWindAlert && (
          <button
            type="button"
            disabled={windAlertBusy}
            className={`text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50 ${
              route.windAlertEnabled
                ? 'text-[var(--color-trail)]'
                : 'text-[var(--color-stone)]'
            }`}
            onClick={() => onToggleWindAlert(route)}
          >
            {route.windAlertEnabled ? 'Avisando' : 'Avisar'}
          </button>
        )}
      </div>
    </article>
  )
}
