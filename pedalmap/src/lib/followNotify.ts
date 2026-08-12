import { communityService } from '@/services/CommunityService'

/** Request browser/PWA notification permission. Preference is saved by ProfilePage. */
export async function enableFollowPushPreference(_uid: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  return permission === 'granted'
}

/** When the user opens the app, surface unread follow inbox items as local notifications. */
export async function deliverPendingFollowNotifications(userId: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (!communityService.isConfigured()) return
  try {
    const items = await communityService.listUnreadFollowNotifications(userId, 10)
    if (!items.length) return
    const registration = await navigator.serviceWorker?.ready.catch(() => null)
    for (const item of items.slice(0, 3)) {
      const title = 'PedalMap'
      const body = `${item.fromDisplayName} te sigue`
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          data: { url: '/explorar' },
          tag: `follow-${item.fromUserId}`,
        })
      } else {
        new Notification(title, { body })
      }
    }
    await communityService.markNotificationsRead(
      userId,
      items.map((i) => i.id),
    )
  } catch (error) {
    console.warn('[pwa] follow notifications', error)
  }
}
