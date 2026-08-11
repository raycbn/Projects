import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { shouldUseHostAsAuthDomain } from '@/lib/siteConfig'

/**
 * On production hosts (custom domain + Firebase Hosting), use the current
 * hostname as authDomain so signInWithRedirect stays first-party.
 */
function resolveAuthDomain(): string {
  const configured = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '')
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (shouldUseHostAsAuthDomain(host)) return host
  }
  return configured
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.apiKey !== 'your-api-key',
  )
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null
let functionsClient: Functions | null = null

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Copy .env.example to .env.local and fill values.')
  }
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp())
  return auth
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp())
  return db
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(getFirebaseApp())
  return storage
}

export function getFirebaseFunctions(): Functions {
  if (!functionsClient) {
    const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'europe-west1'
    functionsClient = getFunctions(getFirebaseApp(), region)
  }
  return functionsClient
}
