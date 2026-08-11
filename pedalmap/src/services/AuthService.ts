import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import type { UserProfile } from '@/domain/types'
import { getDb, getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { needsGoogleAuthBridge, startGoogleAuthBridge } from '@/lib/authBridge'
import { track } from '@/lib/analytics'
import { communityService } from '@/services/CommunityService'
import { applyPremiumAllowlist } from '@/lib/premiumAllowlist'

const googleProvider = new GoogleAuthProvider()

/** Popup + COOP is unreliable on phones / in-app browsers. Prefer redirect there. */
export function prefersGoogleRedirect(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const inApp = /Instagram|FBAN|FBAV|Line\/|WhatsApp|Twitter/i.test(ua)
  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
  return mobile || inApp || coarse
}

export function authErrorMessage(error: unknown, fallback: string): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code || '')
      : ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Inicio con Google cancelado.'
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Reinténtalo; usaremos redirección.'
    case 'auth/unauthorized-domain':
      return 'Este dominio no está autorizado en Firebase Auth.'
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa la red e inténtalo de nuevo.'
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con este email usando otro método.'
    default:
      return fallback
  }
}

function emptyProfile(user: User): UserProfile {
  const now = new Date().toISOString()
  const email = user.email
  return {
    uid: user.uid,
    email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    // Plan starts free; Worker /me/sync-plan upgrades allowlisted emails via Admin.
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
      try {
        await communityService.upsertPublicProfile({
          uid: user.uid,
          displayName: user.displayName ?? (snap.data() as UserProfile).displayName,
          photoURL: user.photoURL ?? (snap.data() as UserProfile).photoURL,
        })
      } catch (error) {
        console.warn('[auth] public profile', error)
      }
      return applyPremiumAllowlist({
        ...(snap.data() as UserProfile),
        email: (snap.data() as UserProfile).email ?? user.email,
      })
    }
    const profile = emptyProfile(user)
    await setDoc(ref, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    try {
      await communityService.upsertPublicProfile({
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
      })
    } catch (error) {
      console.warn('[auth] public profile', error)
    }
    return applyPremiumAllowlist(profile)
  }

  watchProfile(uid: string, callback: (profile: UserProfile | null) => void): () => void {
    return onSnapshot(doc(getDb(), 'users', uid), (snap) => {
      if (!snap.exists()) {
        callback(null)
        return
      }
      callback(applyPremiumAllowlist(snap.data() as UserProfile))
    })
  }

  /**
   * Completes Google redirect sign-in after returning from accounts.google.com.
   * Safe to call on every cold start; no-ops when there is no pending redirect.
   */
  async completeGoogleRedirect(): Promise<User | null> {
    const result = await getRedirectResult(getFirebaseAuth())
    if (!result?.user) return null
    await this.ensureProfile(result.user)
    track('signup_completed', { method: 'google' })
    return result.user
  }

  /** Exchange a Worker-minted custom token for a Firebase session (auth bridge return). */
  async completeCustomToken(customToken: string): Promise<User> {
    const result = await signInWithCustomToken(getFirebaseAuth(), customToken)
    await this.ensureProfile(result.user)
    track('signup_completed', { method: 'google' })
    return result.user
  }

  /**
   * Google sign-in on the current host (popup or redirect).
   * Used by the auth bridge page on *.web.app — do not add cross-domain logic here.
   */
  async signInGoogleDirect(): Promise<User | null> {
    const auth = getFirebaseAuth()

    // Always redirect on coarse/mobile/in-app browsers. Popup leaves a stuck overlay
    // that blocks the app on many phones and embedded webviews.
    if (prefersGoogleRedirect()) {
      await signInWithRedirect(auth, googleProvider)
      return null
    }

    try {
      const result = await signInWithPopup(auth, googleProvider)
      await this.ensureProfile(result.user)
      track('signup_completed', { method: 'google' })
      return result.user
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code?: string }).code || '')
          : ''
      // Popup blocked / COOP / cancelled → fall back to redirect (no stuck window).
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, googleProvider)
        return null
      }
      throw error
    }
  }

  async signInGoogle(): Promise<User | null> {
    track('signup_started', { method: 'google' })
    // Emergency only: VITE_FORCE_GOOGLE_AUTH_BRIDGE=true hops via *.web.app.
    if (typeof window !== 'undefined' && needsGoogleAuthBridge()) {
      startGoogleAuthBridge(`${window.location.origin}/login`)
      return null
    }
    return this.signInGoogleDirect()
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

  async updateBikePreferences(uid: string, bikePreferences: UserProfile['bikePreferences']): Promise<void> {
    const ref = doc(getDb(), 'users', uid)
    await setDoc(
      ref,
      {
        bikePreferences,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  /** Client-side usage counters (Spark — no Cloud Functions required). */
  async recordRouteCreated(uid: string): Promise<void> {
    const ref = doc(getDb(), 'users', uid)
    const snap = await getDoc(ref)
    const key = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`
    const usage = (snap.data()?.usage as UserProfile['usage'] | undefined) ?? {
      routesCreatedThisMonth: 0,
      routesSaved: 0,
      monthKey: key,
    }
    const created =
      usage.monthKey === key ? (usage.routesCreatedThisMonth ?? 0) + 1 : 1
    await setDoc(
      ref,
      {
        usage: {
          routesCreatedThisMonth: created,
          routesSaved: usage.routesSaved ?? 0,
          monthKey: key,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  async recordRouteSaved(uid: string): Promise<void> {
    const ref = doc(getDb(), 'users', uid)
    const snap = await getDoc(ref)
    const usage = (snap.data()?.usage as UserProfile['usage'] | undefined) ?? {
      routesCreatedThisMonth: 0,
      routesSaved: 0,
      monthKey: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`,
    }
    await setDoc(
      ref,
      {
        usage: {
          ...usage,
          routesSaved: (usage.routesSaved ?? 0) + 1,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  async recordRouteDeleted(uid: string): Promise<void> {
    const ref = doc(getDb(), 'users', uid)
    const snap = await getDoc(ref)
    const usage = (snap.data()?.usage as UserProfile['usage'] | undefined) ?? {
      routesCreatedThisMonth: 0,
      routesSaved: 0,
      monthKey: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`,
    }
    await setDoc(
      ref,
      {
        usage: {
          ...usage,
          routesSaved: Math.max(0, (usage.routesSaved ?? 0) - 1),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }
}

export const authService = new AuthService()
