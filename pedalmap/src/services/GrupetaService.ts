import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'

function apiBase(): string {
  const url =
    import.meta.env.VITE_PEDALMAP_API_URL ||
    import.meta.env.VITE_ROUTING_PROXY_URL ||
    ''
  return typeof url === 'string' ? url.replace(/\/+$/, '') : ''
}

async function authHeader(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('Debes iniciar sesión')
  const token = await user.getIdToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export type GrupetaSeatView = {
  email: string | null
  role: 'owner' | 'member'
  hasUid: boolean
  assignedAt: string
}

export type GrupetaPackView = {
  ownerUid: string
  status: string
  interval: 'month' | 'year'
  seatLimit: number
  billable: boolean
  seats: GrupetaSeatView[]
  updatedAt: string
  viewerRole?: 'member'
}

export type GrupetaPackResponse = {
  ok: boolean
  seatLimit: number
  memberSeats: number
  prices: { month: string; year: string }
  pack: GrupetaPackView | null
  error?: string
}

export class GrupetaService {
  isConfigured(): boolean {
    return isFirebaseConfigured() && Boolean(apiBase())
  }

  async getPack(): Promise<GrupetaPackResponse> {
    const res = await fetch(`${apiBase()}/grupeta/pack`, {
      method: 'GET',
      headers: await authHeader(),
    })
    const data = (await res.json()) as GrupetaPackResponse
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo cargar el Pack Grupeta')
    }
    return data
  }

  async setMemberEmails(emails: string[]): Promise<GrupetaPackResponse & {
    grantedNow?: string[]
    pendingSignup?: string[]
    removed?: string[]
  }> {
    const res = await fetch(`${apiBase()}/grupeta/seats`, {
      method: 'POST',
      headers: await authHeader(),
      body: JSON.stringify({ emails }),
    })
    const data = (await res.json()) as GrupetaPackResponse & {
      grantedNow?: string[]
      pendingSignup?: string[]
      removed?: string[]
      error?: string
    }
    if (!res.ok) {
      throw new Error(data.error || 'No se pudieron guardar los emails')
    }
    return data
  }
}

export const grupetaService = new GrupetaService()
