import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'

function apiBase(): string {
  const url =
    import.meta.env.VITE_PEDALMAP_API_URL ||
    import.meta.env.VITE_ROUTING_PROXY_URL ||
    ''
  return typeof url === 'string' ? url.replace(/\/+$/, '') : ''
}

export type WindAlertEmailPayload = {
  routeId: string
  routeTitle: string
  caption: string
  score: number
  startHour: string
  endHour: string
}

/**
 * Soft email stub — Worker no-ops without RESEND_API_KEY.
 * Safe to fire-and-forget from the in-app banner.
 */
export class AlertService {
  isConfigured(): boolean {
    return isFirebaseConfigured() && Boolean(apiBase())
  }

  async sendWindAlertEmail(payload: WindAlertEmailPayload): Promise<{
    ok: boolean
    sent: boolean
  }> {
    if (!this.isConfigured()) return { ok: false, sent: false }
    const user = getFirebaseAuth().currentUser
    if (!user || user.isAnonymous) return { ok: false, sent: false }
    const token = await user.getIdToken()
    const response = await fetch(`${apiBase()}/alerts/email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      sent?: boolean
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo enviar el aviso')
    }
    return { ok: Boolean(data.ok), sent: Boolean(data.sent) }
  }

  /** Fire-and-forget: email the followee (+ PWA install hint when no push). */
  async notifyFollow(followeeId: string, followerDisplayName: string): Promise<void> {
    if (!this.isConfigured()) return
    const user = getFirebaseAuth().currentUser
    if (!user || user.isAnonymous) return
    try {
      const token = await user.getIdToken()
      await fetch(`${apiBase()}/alerts/follow`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ followeeId, followerDisplayName }),
      })
    } catch (error) {
      console.warn('[alerts] follow notify', error)
    }
  }

  /** Fire-and-forget: email after any saved/published route. */
  async notifyRouteSaved(input: {
    routeTitle: string
    shareSlug?: string
    distanceMeters?: number
    elevationGainMeters?: number
  }): Promise<void> {
    if (!this.isConfigured()) return
    const user = getFirebaseAuth().currentUser
    if (!user || user.isAnonymous) return
    try {
      const token = await user.getIdToken()
      await fetch(`${apiBase()}/alerts/route-saved`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })
    } catch (error) {
      console.warn('[alerts] route-saved', error)
    }
  }

  /** Fire-and-forget: email route owner when someone gives Cheers. */
  async notifyCheers(routeId: string, cheerDisplayName: string): Promise<void> {
    if (!this.isConfigured()) return
    const user = getFirebaseAuth().currentUser
    if (!user || user.isAnonymous) return
    try {
      const token = await user.getIdToken()
      await fetch(`${apiBase()}/alerts/cheers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ routeId, cheerDisplayName }),
      })
    } catch (error) {
      console.warn('[alerts] cheers notify', error)
    }
  }
}

export const alertService = new AlertService()
