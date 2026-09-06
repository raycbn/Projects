import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

/**
 * Persists / offers a GPX file.
 *
 *  - Web / Capacitor iOS / dev server: keeps the existing behaviour
 *    (Blob + `download` attribute anchor) so desktop/mobile browser UX is
 *    untouched.
 *  - Android (Capacitor): writes app-scoped via Filesystem (no storage
 *    permission required under scoped storage) instead of relying on the
 *    WebView `a[download]` which is unreliable on Android.
 *
 * The GPX content (`xml`) is shared verbatim: it is the exact string
 * returned by `exportRouteToGpx` — no transformation.
 */
export async function saveGpxFile(
  xml: string,
  filename: string,
): Promise<void> {
  if (filename.slice(-4) !== '.gpx') {
    throw new Error('Filename must end with .gpx')
  }

  if (Capacitor.getPlatform() === 'android') {
    await Filesystem.writeFile({
      path: filename,
      data: xml,
      directory: Directory.Data,
    })
    return
  }

  const blob = new Blob([xml], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  // Click synchronously in a user gesture context; the caller already gates this
  // on a click handler.
  a.click()
  URL.revokeObjectURL(url)
}
