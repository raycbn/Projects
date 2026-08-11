import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

interface RideChooserSheetProps {
  open: boolean
  onClose: () => void
  onNavigate: () => void
  onRecord: () => void
  onExportGpx?: () => void
}

/** Bottom sheet: one job — choose how to ride this route. */
export function RideChooserSheet({
  open,
  onClose,
  onNavigate,
  onRecord,
  onExportGpx,
}: RideChooserSheetProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ride-chooser-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-rise rounded-t-3xl bg-white p-5 shadow-2xl safe-pb sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
          Salir a rodar
        </p>
        <h2 id="ride-chooser-title" className="mt-2 font-display text-2xl font-extrabold text-[var(--color-forest)]">
          ¿Cómo quieres salir?
        </h2>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          Elige una opción. El resto queda en la ruta para después.
        </p>
        <div className="mt-5 space-y-2">
          <Button className="w-full" onClick={onNavigate}>
            Navegar en el mapa
          </Button>
          <Button className="w-full" variant="secondary" onClick={onRecord}>
            Grabar con GPS
          </Button>
          {onExportGpx && (
            <button
              type="button"
              className="w-full py-2 text-sm font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
              onClick={onExportGpx}
            >
              Enviar GPX al GPS (Garmin, Wahoo…)
            </button>
          )}
        </div>
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-[var(--color-stone)]">
          ¿Sin ruta?{' '}
          <Link to="/route-planner" className="font-semibold text-[var(--color-trail)]">
            Crear una
          </Link>
        </p>
      </div>
    </div>
  )
}
