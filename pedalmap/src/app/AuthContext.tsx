import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '@/domain/types'
import { authService } from '@/services/AuthService'
import { isFirebaseConfigured } from '@/lib/firebase'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  firebaseReady: boolean
  signInGoogle: () => Promise<void>
  signInEmail: (email: string, password: string) => Promise<void>
  registerEmail: (email: string, password: string, name?: string) => Promise<void>
  signInGuest: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const firebaseReady = isFirebaseConfigured()

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false)
      return
    }
    return authService.watch(async (next) => {
      setUser(next)
      if (next) {
        try {
          const p = await authService.ensureProfile(next)
          setProfile(p)
        } catch (error) {
          console.error('[auth] profile', error)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
  }, [firebaseReady])

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    firebaseReady,
    async signInGoogle() {
      await authService.signInGoogle()
    },
    async signInEmail(email, password) {
      await authService.signInEmail(email, password)
    },
    async registerEmail(email, password, name) {
      await authService.registerEmail(email, password, name)
    },
    async signInGuest() {
      await authService.signInGuest()
    },
    async resetPassword(email) {
      await authService.resetPassword(email)
    },
    async logout() {
      await authService.logout()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
