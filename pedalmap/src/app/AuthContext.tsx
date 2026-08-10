import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '@/domain/types'
import { authErrorMessage, authService } from '@/services/AuthService'
import { isFirebaseConfigured } from '@/lib/firebase'
import { syncServerPlan } from '@/lib/planSync'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  firebaseReady: boolean
  authError: string | null
  clearAuthError: () => void
  signInGoogle: () => Promise<void>
  signInEmail: (email: string, password: string) => Promise<void>
  registerEmail: (email: string, password: string, name?: string) => Promise<void>
  signInGuest: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
  updateBikePreferences: (bikePreferences: UserProfile['bikePreferences']) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const firebaseReady = isFirebaseConfigured()

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false)
      return
    }
    let cancelled = false
    let unsubProfile: (() => void) | undefined

    // Finish Google redirect before attaching the auth listener so the session is ready.
    void authService
      .completeGoogleRedirect()
      .catch((error) => {
        console.error('[auth] google redirect', error)
        if (!cancelled) {
          setAuthError(authErrorMessage(error, 'No se pudo iniciar sesión con Google.'))
        }
      })

    const unsubAuth = authService.watch(async (next) => {
      if (cancelled) return
      unsubProfile?.()
      unsubProfile = undefined
      setUser(next)
      if (next) {
        try {
          await authService.ensureProfile(next)
          if (cancelled) return
          // Server-authoritative allowlist → Firestore plan (Worker Admin).
          if (!next.isAnonymous) {
            await syncServerPlan()
          }
          const p = await authService.ensureProfile(next)
          if (cancelled) return
          setProfile({
            ...p,
            email: p.email ?? next.email,
          })
          unsubProfile = authService.watchProfile(next.uid, (live) => {
            if (live) {
              setProfile({
                ...live,
                email: live.email ?? next.email,
              })
            }
          })
        } catch (error) {
          console.error('[auth] profile', error)
          if (!cancelled) setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
      unsubProfile?.()
      unsubAuth()
    }
  }, [firebaseReady])

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    firebaseReady,
    authError,
    clearAuthError() {
      setAuthError(null)
    },
    async signInGoogle() {
      setAuthError(null)
      await authService.signInGoogle()
    },
    async signInEmail(email, password) {
      setAuthError(null)
      await authService.signInEmail(email, password)
    },
    async registerEmail(email, password, name) {
      setAuthError(null)
      await authService.registerEmail(email, password, name)
    },
    async signInGuest() {
      setAuthError(null)
      await authService.signInGuest()
    },
    async resetPassword(email) {
      setAuthError(null)
      await authService.resetPassword(email)
    },
    async logout() {
      await authService.logout()
    },
    async updateBikePreferences(bikePreferences) {
      if (!user) throw new Error('Debes iniciar sesión')
      await authService.updateBikePreferences(user.uid, bikePreferences)
      setProfile((prev) => (prev ? { ...prev, bikePreferences } : prev))
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
