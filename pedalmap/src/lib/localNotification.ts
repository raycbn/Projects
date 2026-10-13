import { Capacitor } from '@capacitor/core'

declare module '@capacitor/core' {
  interface PluginRegistry {
    LocalNotification?: {
      checkPermissions(): Promise<{ receive: string }>
      requestPermissions(): Promise<{ receive: string }>
      showSavedGpxNotification(opts: {
        title: string
        fileName: string
        bodyText: string
        uri: string
      }): Promise<{
        shown: boolean
        notificationId: number
      }>
      showRouteReadyNotification(opts: {
        title?: string
        bodyText?: string
        routeSlug?: string
      }): Promise<{
        shown: boolean
        notificationId: number
      }>
    }
  }
}

export interface SavedGpxNotificationOptions {
  title: string
  fileName: string
  bodyText: string
  uri: string
}

export interface SavedGpxNotificationResult {
  shown: boolean
  notificationId: number
}

export interface RouteReadyNotificationOptions {
  title?: string
  bodyText?: string
  routeSlug?: string
}

export interface RouteReadyNotificationResult {
  shown: boolean
  notificationId: number
}

async function getPlugin(): Promise<LocalNotificationPlugin | null> {
  if (!Capacitor.isNativePlatform()) return null
  const plugin = (Capacitor as { Plugins?: Record<string, unknown> }).Plugins?.LocalNotification
  if (!plugin) return null
  return plugin as unknown as LocalNotificationPlugin
}

interface LocalNotificationPlugin {
  checkPermissions(): Promise<{ receive: string }>
  requestPermissions(): Promise<{ receive: string }>
  showSavedGpxNotification(opts: SavedGpxNotificationOptions): Promise<SavedGpxNotificationResult>
  showRouteReadyNotification(opts: RouteReadyNotificationOptions): Promise<RouteReadyNotificationResult>
}

async function ensureNotificationPermission(): Promise<boolean> {
  const plugin = await getPlugin()
  if (!plugin) {
    console.warn('[gpx] LocalNotification plugin not available')
    return false
  }
  try {
    const status = await plugin.checkPermissions()
    const receive = status.receive
    console.log('[gpx] checking notification permission')
    console.log('[gpx] notification permission before request=' + receive)
    if (receive === 'granted') return true

    console.log('[gpx] requesting POST_NOTIFICATIONS')
    const granted = await plugin.requestPermissions()
    const result = granted.receive
    console.log('[gpx] notification permission result=' + result)
    if (result === 'granted') return true

    console.log('[gpx] notification permission denied after request')
    return false
  } catch (error) {
    console.warn('[gpx] permission check failed: ' + (error as Error)?.message)
    return false
  }
}

export async function showSavedGpxNotification(
  opts: SavedGpxNotificationOptions,
): Promise<SavedGpxNotificationResult | null> {
  const plugin = await getPlugin()
  if (!plugin) {
    console.warn('[gpx] LocalNotification plugin not available')
    return null
  }

  const granted = await ensureNotificationPermission()
  if (!granted) {
    console.log('[gpx] notification permission denied; GPX saved in Documents but no notification')
    return null
  }

  try {
    console.log('[gpx] posting saved GPX notification')
    const result = await plugin.showSavedGpxNotification(opts)
    console.log('[gpx] notification posted=' + (result?.shown ?? false))
    return result
  } catch (error) {
    console.warn('[gpx] notification error=' + (error as Error)?.message)
    return null
  }
}

export async function showRouteReadyNotification(
  opts: RouteReadyNotificationOptions = {},
): Promise<RouteReadyNotificationResult | null> {
  const plugin = await getPlugin()
  if (!plugin) {
    console.warn('[route-ready] LocalNotification plugin not available')
    return null
  }

  const granted = await ensureNotificationPermission()
  if (!granted) {
    console.log('[route-ready] notification permission denied; route ready but no notification')
    return null
  }

  try {
    console.log('[route-ready] posting route ready notification routeSlug=' + opts.routeSlug)
    const result = await plugin.showRouteReadyNotification(opts)
    console.log('[route-ready] notification posted=' + (result?.shown ?? false))
    return result
  } catch (error) {
    console.warn('[route-ready] notification error=' + (error as Error)?.message)
    return null
  }
}
