import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { shareRouteNative, shareRouteToInstagramStory } from '@/lib/routeShare'

/**
 * Converts a Blob to a base64 string (without data URL prefix) for Capacitor Filesystem.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] || result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Saves a PNG blob to the app cache directory and returns the file URI.
 * On Android, returns a content:// URI via FileProvider.
 */
async function saveShareImageToCache(
  blob: Blob,
  filename: string,
  flow: 'route' | 'story',
  shareStartedAt = performance.now(),
): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  console.log('[share-debug] function=saveShareImageToCache phase=before filename=' + filename)
  try {
    let stageStartedAt = performance.now()
    console.log('[share-timing] blobToBase64=start flow=' + flow)
    const base64 = await blobToBase64(blob)
    console.log('[share-timing] blobToBase64=' + Math.round(performance.now() - stageStartedAt) + 'ms flow=' + flow)

    stageStartedAt = performance.now()
    console.log('[share-timing] Filesystem.writeFile=start flow=' + flow)
    await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    })
    console.log('[share-timing] Filesystem.writeFile=' + Math.round(performance.now() - stageStartedAt) + 'ms flow=' + flow)

    stageStartedAt = performance.now()
    if (flow === 'route') {
      console.log('[share-timing] Filesystem.stat=start flow=route')
    }
    const stat = await Filesystem.stat({
      path: filename,
      directory: Directory.Cache,
    })
    if (flow === 'route') {
      console.log('[share-timing] Filesystem.stat=' + Math.round(performance.now() - stageStartedAt) + 'ms flow=route')
    }
    console.log('[share-debug] function=saveShareImageToCache phase=after imageUri=' + stat.uri)
    console.log('[share] saved share image to cache: ' + stat.uri)
    return stat.uri
  } catch (error) {
    console.log('[share-debug] function=saveShareImageToCache phase=error error=' + (error as Error)?.message)
    console.warn('[share] failed to save image to cache: ' + (error as Error)?.message)
    return null
  }
}

/**
 * Native Android route sharing.
 * Generates a share card PNG, saves it to cache, and launches
 * the Android Sharesheet via RouteSharePlugin.
 */
export async function shareRouteCardNative(
  title: string,
  text: string,
  url: string,
  imageBlob: Blob,
  shareStartedAt = performance.now(),
): Promise<boolean> {
  console.log('[share] route share start')
  console.log('[share] platform=android')
  const imageUri = await saveShareImageToCache(imageBlob, 'pedalmap-share.png', 'route', shareStartedAt)
  if (!imageUri) {
    console.warn('[share] could not save share image; falling back to text-only share')
  }
  const success = await shareRouteNative(
    {
      title,
      text,
      url,
      imageUri: imageUri ?? undefined,
    },
    shareStartedAt,
    'route',
  )
  return success
}

/**
 * Native Android Instagram Story sharing.
 * Generates a story card PNG, saves it to cache, and launches
 * the Instagram ADD_TO_STORY intent via RouteSharePlugin.
 */
export async function shareRouteStoryNative(
  title: string,
  text: string,
  url: string,
  imageBlob: Blob,
  shareStartedAt = performance.now(),
): Promise<boolean> {
  console.log('[share] Instagram Story share start')
  const imageUri = await saveShareImageToCache(imageBlob, 'pedalmap-story.png', 'story', shareStartedAt)
  if (!imageUri) {
    console.warn('[share] could not save story image; cannot share to Instagram')
    return false
  }
  const success = await shareRouteToInstagramStory(
    {
      title,
      text,
      url,
      imageUri,
    },
    shareStartedAt,
  )
  return success
}
