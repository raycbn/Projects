import { useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { importedGpxToDraft, parseGpx } from '@/lib/gpx'
import type { RouteDraft } from '@/domain/types'

interface GPXImporterProps {
  onImported: (draft: RouteDraft) => void
}

export function GPXImporter({ onImported }: GPXImporterProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml,text/xml"
        className="sr-only"
        aria-label="Importar archivo GPX"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            try {
              const imported = parseGpx(String(reader.result))
              onImported(importedGpxToDraft(imported))
            } catch (error) {
              console.error('[gpx import]', error)
              alert('No se pudo importar el GPX. Comprueba que el archivo sea válido.')
            }
          }
          reader.readAsText(file)
          e.target.value = ''
        }}
      />
      <Button variant="ghost" onClick={() => inputRef.current?.click()}>
        Importar GPX
      </Button>
    </>
  )
}
