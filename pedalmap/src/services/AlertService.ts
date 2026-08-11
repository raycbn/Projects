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
}

export const alertService = new AlertService()
