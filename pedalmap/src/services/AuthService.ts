import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { UserProfile } from '@/domain/types'
import { getDb, getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { track } from '@/lib/analytics'

const googleProvider = new GoogleAuthProvider()

function emptyProfile(user: User): UserProfile {
  const now = new Date().toISOString()
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    plan: 'free',
    bikePreferences: {
      bikeType: 'road',
      preferences: [],
    },
    usage: {
      routesCreatedThisMonth: 0,
      routesSaved: 0,
      monthKey: `${new Date().getUTCFullYear()}-${String(dateMonth()).padStart(2, '0')}`,
    },
    createdAt: now,
    updatedAt: now,
  }
}

function dateMonth(): number {
  return new Date().getUTCMonth() + 1
}

export class AuthService {
  isConfigured(): boolean {
    return isFirebaseConfigured()
  }

  watch(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(getFirebaseAuth(), callback)
  }

  async ensureProfile(user: User): Promise<UserProfile> {
    const ref = doc(getDb(), 'users', user.uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      return snap.data() as UserProfile
    }
    const profile = emptyProfile(user)
    await setDoc(ref, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return profile
  }

  async signInGoogle(): Promise<User> {
    track('signup_started', { method: 'google' })
    const result = await signInWithPopup(getFirebaseAuth(), googleProvider)
    await this.ensureProfile(result.user)
    track('signup_completed', { method: 'google' })
    return result.user
  }

  async registerEmail(email: string, password: string, displayName?: string): Promise<User> {
    track('signup_started', { method: 'email' })
    const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
    if (displayName) {
      await updateProfile(result.user, { displayName })
    }
    await this.ensureProfile(result.user)
    track('signup_completed', { method: 'email' })
    return result.user
  }

  async signInEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
    await this.ensureProfile(result.user)
    return result.user
  }

  async signInGuest(): Promise<User> {
    const result = await signInAnonymously(getFirebaseAuth())
    await this.ensureProfile(result.user)
    return result.user
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(getFirebaseAuth(), email)
  }

  async logout(): Promise<void> {
    await signOut(getFirebaseAuth())
  }
}

export const authService = new AuthService()
