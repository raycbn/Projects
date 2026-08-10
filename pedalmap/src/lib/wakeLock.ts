/**
 * Keep the screen awake while GPS recording (phones sleep and kill watchPosition).
 */
export type WakeLockHandle = { release: () => Promise<void> }

export async function requestScreenWakeLock(): Promise<WakeLockHandle | null> {
  if (typeof navigator === 'undefined') return null
  const anyNav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void>; addEventListener: (t: string, fn: () => void) => void }> }
  }
  if (!anyNav.wakeLock?.request) return null
  try {
    const sentinel = await anyNav.wakeLock.request('screen')
    return {
      async release() {
        try {
          await sentinel.release()
        } catch {
          /* ignore */
        }
      },
    }
  } catch (error) {
    console.warn('[wakeLock] unavailable', error)
    return null
  }
}
