import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase', () => {
  const state: { currentUser: { uid: string; isAnonymous: boolean } | null } = {
    currentUser: null,
  }
  return {
    isFirebaseConfigured: () => true,
    getFirebaseAuth: () => state,
    getDb: () => ({}),
    __authState: state,
  }
})

vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(async (auth: { currentUser: { uid: string; isAnonymous: boolean } | null }) => {
    const user = { uid: 'anon-1', isAnonymous: true }
    auth.currentUser = user
    return { user }
  }),
  GoogleAuthProvider: class {
    setCustomParameters() {
      return this
    }
    addScope() {
      return this
    }
    static credential() {
      return {}
    }
  },
  getRedirectResult: vi.fn(),
  onAuthStateChanged: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signInWithCredential: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(async () => undefined),
}))

vi.mock('@/lib/authLock', () => ({
  withAuthLock: <T,>(fn: () => Promise<T>) => fn(),
}))
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/services/CommunityService', () => ({
  communityService: { upsertPublicProfile: vi.fn(async () => undefined) },
}))
vi.mock('@/lib/premiumAllowlist', () => ({
  applyPremiumAllowlist: <T,>(p: T) => p,
}))
vi.mock('@/lib/googleIdentity', () => ({
  requestGoogleAccessToken: vi.fn(),
}))
vi.mock('@/lib/authBridge', () => ({
  needsGoogleAuthBridge: () => false,
  startGoogleAuthBridge: vi.fn(),
}))

describe('AuthService.signInGuest race safety', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('does not replace an existing non-anonymous session', async () => {
    const { getFirebaseAuth } = await import('@/lib/firebase')
    const auth = getFirebaseAuth() as { currentUser: { uid: string; isAnonymous: boolean } | null }
    auth.currentUser = { uid: 'real-user', isAnonymous: false }

    const { authService } = await import('@/services/AuthService')
    const { signInAnonymously } = await import('firebase/auth')

    const user = await authService.signInGuest()
    expect(user.uid).toBe('real-user')
    expect(user.isAnonymous).toBe(false)
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('reuses an existing anonymous session', async () => {
    const { getFirebaseAuth } = await import('@/lib/firebase')
    const auth = getFirebaseAuth() as { currentUser: { uid: string; isAnonymous: boolean } | null }
    auth.currentUser = { uid: 'anon-existing', isAnonymous: true }

    const { authService } = await import('@/services/AuthService')
    const { signInAnonymously } = await import('firebase/auth')

    const user = await authService.signInGuest()
    expect(user.uid).toBe('anon-existing')
    expect(signInAnonymously).not.toHaveBeenCalled()
  })
})
