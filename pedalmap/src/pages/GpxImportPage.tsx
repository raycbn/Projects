import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { parseGpx, importedGpxToDraft } from '@/lib/gpx'
import { pickGpxFile } from '@/lib/documentPicker'
import { usePlanner } from '@/app/PlannerContext'
import { Button } from '@/components/ui/Button'

export function GpxImportPage() {
  const navigate = useNavigate()
  const isNative = Capacitor.isNativePlatform()
  const { setDraftFromImport } = usePlanner()
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  async function handlePickAndImport() {
    setIsImporting(true)
    setImportError(null)
    try {
      if (isNative) {
        const result = await pickGpxFile()
        if (!result) {
          alert('No se seleccionó ningún archivo')
          return
        }
        const imported = parseGpx(result.content)
        const draft = importedGpxToDraft(imported)
        setDraftFromImport(draft)
        navigate('/route-planner')
      } else {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.gpx,application/gpx+xml,text/xml'
        input.onchange = () => {
          const file = input.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            try {
              const imported = parseGpx(String(reader.result))
              const draft = importedGpxToDraft(imported)
              setDraftFromImport(draft)
              navigate('/route-planner')
            } catch {
              alert('No se pudo importar el GPX. Comprueba que el archivo sea válido.')
            }
          }
          reader.readAsText(file)
        }
        input.click()
      }
    } catch (error) {
      console.error('[gpx import]', error)
      setImportError('No se pudo importar el GPX. Comprueba que el archivo sea válido.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Importar ruta GPX</h1>
      {importError && (
        <div className="p-4 mb-4 text-red-700 bg-red-50 rounded border border-red-200">{importError}</div>
      )}
      <div className="space-y-4">
        <p className="text-muted-foreground">
          {isNative
            ? 'Selecciona un archivo GPX desde tu dispositivo.'
            : 'Selecciona un archivo GPX desde tu computadora.'}
        </p>
        <Button onClick={handlePickAndImport} disabled={isImporting} className="w-full">
          {isImporting ? 'Importando...' : 'Seleccionar archivo GPX'}
        </Button>
      </div>
    </div>
  )
}
