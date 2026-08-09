import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { shareUrl } from '@/lib/share'
import { track } from '@/lib/analytics'

interface ShareDialogProps {
  url: string
  title: string
  onClose: () => void
}

export function ShareDialog({ url, title, onClose }: ShareDialogProps) {
  const [status, setStatus] = useState<string | null>(null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
    >
      <div className="w-full max-w-md animate-rise rounded-3xl bg-white p-6 shadow-xl">
        <h2 id="share-title" className="font-display text-2xl font-extrabold text-[var(--color-forest)]">
          Compartir ruta
        </h2>
        <p className="mt-2 break-all rounded-xl bg-[var(--color-mist)] px-3 py-2 text-sm">{url}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              void shareUrl(url, title).then((result) => {
                track('route_shared', { method: result })
                setStatus(
                  result === 'shared'
                    ? 'Compartido'
                    : result === 'copied'
                      ? 'Enlace copiado'
                      : 'No se pudo compartir',
                )
              })
            }}
          >
            Copiar / Compartir
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {status && <p className="mt-3 text-sm text-[var(--color-trail)]">{status}</p>}
      </div>
    </div>
  )
}
