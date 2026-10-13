import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { showSavedGpxNotification } from '@/lib/localNotification'

const GPX_MIME = 'application/gpx+xml'

type SaveResult = 'shared' | 'downloaded' | 'saved' | 'canceled'

interface NativeSaveResult {
  ok: boolean
  uri: string | null
}

async function saveGpxNativeFilesystem(xml: string, filename: string): Promise<NativeSaveResult> {
  console.log('[gpx] ENTER saveGpxNativeFilesystem filename=' + filename)
  try {
    await Filesystem.writeFile({
      path: filename,
      data: xml,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    })
    console.log('[gpx] filesystem write success=true file=' + filename)
    try {
      const stat = await Filesystem.stat({
        path: filename,
        directory: Directory.Documents,
      })
      console.log('[gpx] stat success=true file=' + filename + ' size=' + stat.size + ' uri=' + stat.uri)
      if (stat.size > 0) {
        void showSavedGpxNotification({
          title: 'GPX guardado',
          fileName: filename,
          bodyText: 'Guardado en Documentos',
          uri: stat.uri,
        }).then((result) => {
          console.log('[gpx] notification shown=' + (result?.shown ?? false) + ' id=' + (result?.notificationId ?? 0))
        })
      } else {
        console.warn('[gpx] stat size=0, not showing notification')
      }
    } catch (statError) {
      console.warn('[gpx] stat failed: ' + (statError as Error)?.message)
    }
    return { ok: true, uri: null }
  } catch (error) {
    console.warn('[gpx] native filesystem write failed: ' + (error as Error)?.message)
    return { ok: false, uri: null }
  }
}

/**
 * Offers a GPX file to the user.
 *
 *  - Android / iOS (Capacitor WebView): uses the Web Share API file sharing
 *    (`navigator.canShare({ files })`, `navigator.share({ files })`). This opens
 *    the system picker so the user can actually GET the `.gpx` out — e.g.
 *    "Save to Downloads", Drive, Gmail, OsmAnd, Garmin Connect…
 *    If the Web Share API with files is unavailable on the native WebView,
 *    falls back to writing the file to the public Documents directory via
 *    @capacitor/filesystem so the user can find it in a Files app.
 *  - Web / fallback: keeps the existing Blob + `<a download>` behaviour so the
 *    desktop/mobile-browser download UX is untouched.
 *
 * Returns:
 *  - 'shared'     → the share sheet was used
 *  - 'saved'      → native filesystem write succeeded
 *  - 'downloaded' → blob download (`<a download>`) fallback
 *  - 'canceled'   → user dismissed the share sheet without picking a target (NOT an error)
 *
 * `xml` is the exact string returned by `exportRouteToGpx` (no transformation).
 */
export async function saveGpxFile(
  xml: string,
  filename: string,
): Promise<SaveResult> {
  console.log('[gpx] saveGpxFile ENTERED filename=' + filename)
  if (filename.slice(-4) !== '.gpx') {
    throw new Error('Filename must end with .gpx')
  }
  console.log('[gpx] START filename=' + filename + ' xmlLen=' + xml.length + ' platform=' + (Capacitor.isNativePlatform() ? 'native-android' : 'web') + ' mime=' + GPX_MIME)

  const blob = new Blob([xml], { type: GPX_MIME })

  const hasCanShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
  const hasShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  console.log('[gpx] typeof canShare=' + (hasCanShare ? 'function' : typeof navigator !== 'undefined' ? typeof navigator.canShare : 'undefined-navigator'))
  console.log('[gpx] typeof share=' + (hasShare ? 'function' : typeof navigator !== 'undefined' ? typeof navigator.share : 'undefined-navigator'))

  const canShareFiles = hasCanShare && hasShare
  console.log('[gpx] canShareAvailable=' + canShareFiles)

  if (canShareFiles) {
    const file = new File([blob], filename, { type: GPX_MIME })
    const canShareFilesResult = navigator.canShare({ files: [file] })
    console.log('[gpx] canShare result=' + canShareFilesResult + ' file=' + filename + ' bytes=' + file.size)
    if (canShareFilesResult) {
      console.log('[gpx] path=share-sheet file=' + filename)
      try {
        await navigator.share({
          title: 'GPX PedalMap',
          text: 'Ruta exportada desde PedalMap',
          files: [file],
        })
        console.log('[gpx] share success file=' + filename)
        console.log('[gpx] final result=shared')
        return 'shared'
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('[gpx] share canceled by user file=' + filename)
          console.log('[gpx] final result=canceled')
          return 'canceled'
        }
        console.log('[gpx] share error=' + (error as Error)?.message)
      }
    } else if (Capacitor.isNativePlatform()) {
      console.log('[gpx] path=native-filesystem file=' + filename)
      const result = await saveGpxNativeFilesystem(xml, filename)
      console.log('[gpx] filesystem success=' + result.ok + ' file=' + filename)
      if (result.ok) {
        console.log('[gpx] final result=saved')
        return 'saved'
      }
    }
  } else if (Capacitor.isNativePlatform()) {
    console.log('[gpx] path=native-filesystem (no canShare) file=' + filename)
    const result = await saveGpxNativeFilesystem(xml, filename)
    console.log('[gpx] filesystem success=' + result.ok + ' file=' + filename)
    if (result.ok) {
      console.log('[gpx] final result=saved')
      return 'saved'
    }
  }

  // Web / fallback: Blob + <a download>
  console.log('[gpx] path=blob-download file=' + filename)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  console.log('[gpx] final result=downloaded')
  return 'downloaded'
}
