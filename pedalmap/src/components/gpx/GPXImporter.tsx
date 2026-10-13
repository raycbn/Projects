import { useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/Button'
import { importedGpxToDraft, parseGpx } from '@/lib/gpx'
import { pickGpxFile } from '@/lib/documentPicker'
import type { RouteDraft } from '@/domain/types'

interface GPXImporterProps {
  onImported: (draft: RouteDraft) => void
}

export function GPXImporter({ onImported }: GPXImporterProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function handleNativePick() {
    const result = await pickGpxFile()
    if (!result) {
      console.warn('[gpx-import] native picker returned no result')
      return
    }
    try {
      const imported = parseGpx(result.content)
      onImported(importedGpxToDraft(imported))
    } catch (error) {
      console.error('[gpx import]', error)
      alert('No se pudo importar el GPX. Comprueba que el archivo sea válido.')
    }
  }

  function handleWebPick(e: React.ChangeEvent<HTMLInputElement>) {
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
  }

  const isNative = Capacitor.isNativePlatform()

  return (
    <>
      {isNative ? null : (
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,application/gpx+xml,text/xml"
          className="sr-only"
          aria-label="Importar archivo GPX"
          onChange={handleWebPick}
        />
      )}
      <Button
        variant="ghost"
        onClick={isNative ? () => void handleNativePick() : () => inputRef.current?.click()}
      >
        Importar GPX
      </Button>
    </>
  )
}
