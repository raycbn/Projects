import { Capacitor } from '@capacitor/core'

declare module '@capacitor/core' {
  interface PluginRegistry {
    DocumentPicker?: {
      pickFile(opts: { mimeType?: string; fileName?: string }): Promise<{
        uri: string
        content: string
        name?: string
        mimeType?: string
      }>
      pickGpxFile(): Promise<{
        uri: string
        content: string
        name?: string
        mimeType?: string
      }>
    }
  }
}

export interface PickFileResult {
  uri: string
  content: string
  name?: string
  mimeType?: string
}

export async function pickGpxFile(): Promise<PickFileResult | null> {
  if (!Capacitor.isNativePlatform()) {
    return null
  }
  const plugin = (Capacitor as { Plugins?: Record<string, unknown> }).Plugins?.DocumentPicker
  if (!plugin) {
    console.warn('[gpx-import] DocumentPicker plugin not available')
    return null
  }
  try {
    const result = await (plugin as {
      pickGpxFile: () => Promise<{ uri: string; content: string; name?: string; mimeType?: string }>
    }).pickGpxFile()
    console.log('[gpx-import] picked uri=' + result.uri + ' name=' + result.name + ' contentLen=' + result.content.length)
    return result as PickFileResult
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn('[gpx-import] pickGpxFile failed: ' + msg)
    return null
  }
}
