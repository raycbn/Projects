import { Capacitor } from '@capacitor/core'

declare module '@capacitor/core' {
  interface PluginRegistry {
    RouteShare?: {
      share(opts: {
        title: string
        text?: string
        url: string
        imageUri?: string
      }): Promise<{ status: string }>
      shareToInstagramStory(opts: {
        title: string
        text?: string
        url: string
        imageUri?: string
      }): Promise<{ status: string; instagramInstalled: boolean }>
    }
  }
}

interface RouteSharePlugin {
  share(opts: {
    title: string
    text?: string
    url: string
    imageUri?: string
  }): Promise<{ status: string }>
  shareToInstagramStory(opts: {
    title: string
    text?: string
    url: string
    imageUri?: string
  }): Promise<{ status: string; instagramInstalled: boolean }>
}

async function getPlugin(): Promise<RouteSharePlugin | null> {
  if (!Capacitor.isNativePlatform()) return null
  const plugin = (Capacitor as { Plugins?: Record<string, unknown> }).Plugins?.RouteShare
  if (!plugin) return null
  return plugin as unknown as RouteSharePlugin
}

export async function shareRouteNative(
  opts: {
    title: string
    text?: string
    url: string
    imageUri?: string
  },
  shareStartedAt?: number,
  flow: 'route' | 'story' = 'route',
): Promise<boolean> {
  console.log('[share-debug] function=shareRouteNative phase=before platform=android url=' + opts.url + ' imageUri=' + (opts.imageUri ?? 'none'))
  const plugin = await getPlugin()
  if (!plugin) {
    console.log('[share-debug] function=shareRouteNative phase=plugin-unavailable')
    console.warn('[share] RouteShare plugin not available')
    return false
  }
  try {
    if (shareStartedAt !== undefined) {
      console.log('[share-timing] pre-plugin-total=' + Math.round(performance.now() - shareStartedAt) + 'ms flow=' + flow)
    }
    console.log('[share-timing] RouteSharePlugin.share=before flow=' + flow)
    console.log('[share-debug] function=shareRouteNative method=RouteSharePlugin.share phase=before')
    const result = await plugin.share(opts)
    console.log('[share-debug] function=shareRouteNative method=RouteSharePlugin.share phase=after result=' + JSON.stringify(result))
    console.log('[share] native share result=' + JSON.stringify(result))
    return true
  } catch (error) {
    console.log('[share-debug] function=shareRouteNative method=RouteSharePlugin.share phase=error error=' + (error as Error)?.message)
    console.warn('[share] native share failed: ' + (error as Error)?.message)
    return false
  }
}

export async function shareRouteToInstagramStory(
  opts: {
    title: string
    text?: string
    url: string
    imageUri?: string
  },
  shareStartedAt?: number,
): Promise<boolean> {
  const plugin = await getPlugin()
  if (!plugin) {
    console.warn('[share] RouteShare plugin not available')
    return false
  }
  try {
    if (shareStartedAt !== undefined) {
      console.log('[share-timing] pre-plugin-total=' + Math.round(performance.now() - shareStartedAt) + 'ms flow=story')
    }
    console.log('[share-timing] RouteSharePlugin.shareToInstagramStory=before flow=story')
    console.log('[share] Instagram Story share start')
    const result = await plugin.shareToInstagramStory(opts)
    console.log('[share] Instagram story result=' + JSON.stringify(result))
    if (result.instagramInstalled === false) {
      console.log('[share] fallback=whatsapp_native')
    }
    return result.status === 'story_intent_sent' || result.status === 'story_created'
  } catch (error) {
    console.warn('[share] Instagram story failed: ' + (error as Error)?.message)
    return false
  }
}
