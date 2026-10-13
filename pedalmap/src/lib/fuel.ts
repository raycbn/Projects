const FUEL_BASE_URL = 'https://fuel.pedalmap.es/planner'

import type { User } from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '@/app/AuthContext'
import { FREE_LIMITS, type UserPlan } from '@/domain/types'

export interface HostFuelAuth {
  user: User | null
  localUser: null
  provider: 'local' | 'pedalmap'
  loading: boolean
  firebaseReady: boolean
  plan: 'free' | 'premium' | null
  entitlementLoading: boolean
  entitlementError: boolean
  canSaveRoute: boolean | null
  maxRoutesSaved: number | null
  routesSaved: number
  loginLocal: () => Promise<unknown>
  registerLocal: () => Promise<unknown>
  logout: () => Promise<void>
  handoffLogin: () => Promise<unknown>
}

export function useHostFuelAuth(): HostFuelAuth {
  const { user, profile, loading, firebaseReady, logout } = useAuth()
  const plan: 'free' | 'premium' | null = profile?.plan ?? null
  const usage = profile?.usage
  const canSaveRoute = plan === 'premium' ? true : usage ? usage.routesSaved < FREE_LIMITS.maxRoutesSaved : null
  const maxRoutesSaved = plan === 'premium' ? null : FREE_LIMITS.maxRoutesSaved
  const routesSaved = usage?.routesSaved ?? 0
  return {
    user,
    localUser: null,
    provider: user ? 'pedalmap' : 'local',
    loading,
    firebaseReady,
    plan,
    entitlementLoading: false,
    entitlementError: false,
    canSaveRoute,
    maxRoutesSaved,
    routesSaved,
    loginLocal: async () => {
      throw new Error('login local no disponible en modo app')
    },
    registerLocal: async () => {
      throw new Error('registro local no disponible en modo app')
    },
    logout,
    handoffLogin: async () => {
      throw new Error('handoff no disponible en modo app')
    },
  }
}

export function mapUserPlanToFuelPlan(plan: UserPlan | null): 'free' | 'premium' | null {
  if (plan === 'premium') return 'premium'
  if (plan === 'free') return 'free'
  return null
}



export interface FuelRouteContext {
  distanceKm: number
  durationMinutes: number
  elevationGainM?: number
  temperatureC?: number
  intensity?: string
  goal?: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value)
}

export function buildFuelUrl(context: FuelRouteContext, customToken?: string | null): string {
  const params = new URLSearchParams()

  params.set('source', 'pedalmap')
  params.set('sport', 'cycling')

  if (!isFiniteNumber(context.distanceKm) || context.distanceKm < 0) {
    throw new Error('distanceKm must be a finite non-negative number')
  }
  params.set('distanceKm', String(Math.round(context.distanceKm * 10) / 10))

  if (!isFiniteNumber(context.durationMinutes) || context.durationMinutes <= 0) {
    throw new Error('durationMinutes must be a finite positive number')
  }
  params.set('durationMinutes', String(Math.round(context.durationMinutes)))

  if (isFiniteNumber(context.elevationGainM) && context.elevationGainM >= 0) {
    params.set('elevationGainM', String(Math.round(context.elevationGainM)))
  }

  if (isFiniteNumber(context.temperatureC)) {
    params.set('temperatureC', String(Math.round(context.temperatureC)))
  }

  if (typeof context.intensity === 'string' && context.intensity.trim().length > 0) {
    params.set('intensity', context.intensity.trim())
  }

  if (typeof context.goal === 'string' && context.goal.trim().length > 0) {
    params.set('goal', context.goal.trim())
  }

  const base = `${FUEL_BASE_URL}?${params.toString()}`
  if (!customToken) return base
  return `${base}#pm_ct=${encodeURIComponent(customToken)}`
}

export function canShowFuelCta(context: Partial<FuelRouteContext>): boolean {
  return (
    isFiniteNumber(context.distanceKm) &&
    context.distanceKm >= 0 &&
    isFiniteNumber(context.durationMinutes) &&
    context.durationMinutes > 0
  )
}

/**
 * True when Fuel runs inside the native/Capacitor shell (PedalMap app). In that
 * mode the CTA navigates to the embedded `/fuel/*` route with RouteContext via
 * router state instead of opening the standalone fuel.pedalmap.es popup.
 * Capacitor injects the `Capacitor` global at runtime (not present on the web),
 * so this detection is not fragile and does not touch native code.
 */
export function isFuelEmbeddedApp(): boolean {
  return Capacitor.isNativePlatform()
}
