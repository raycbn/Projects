/**
 * Persist planner draft to the signed-in user's Firestore profile + full geometry in IndexedDB.
 * Spark-friendly: no Cloud Functions.
 * Cloud stores a lean preview; device keeps full coords for nav/reload quality.
 */
import { doc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore'
import type { RouteDraft } from '@/domain/types'
import { getDb, isFirebaseConfigured } from '@/lib/firebase'
import {
  coordsToStored,
  geometryFromStored,
  geometryToStored,
} from '@/services/RouteRepository'

const FIELD = 'plannerDraft'
const IDB_NAME = 'pedalmap-drafts'
const IDB_STORE = 'full'
const IDB_VERSION = 1

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function saveFullLocal(uid: string, draft: RouteDraft): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(draft, uid)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

async function loadFullLocal(uid: string): Promise<RouteDraft | null> {
  const db = await openDb()
  if (!db) return null
  const draft = await new Promise<RouteDraft | null>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(uid)
      req.onsuccess = () => resolve((req.result as RouteDraft) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  db.close()
  return draft
}

async function clearFullLocal(uid: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(uid)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

function sameRouteIdentity(a: RouteDraft, b: RouteDraft): boolean {
  const da = Math.round(a.stats?.distanceMeters ?? 0)
  const db = Math.round(b.stats?.distanceMeters ?? 0)
  if (Math.abs(da - db) > 25) return false
  const a0 = a.geometry?.coordinates?.[0]
  const b0 = b.geometry?.coordinates?.[0]
  if (!a0 || !b0) return false
  return Math.abs(a0[0] - b0[0]) < 1e-4 && Math.abs(a0[1] - b0[1]) < 1e-4
}

/** Normalize cloud lean draft (may store {lng,lat} objects) back to [lng,lat] arrays. */
function hydrateCloudDraft(raw: RouteDraft): RouteDraft {
  const hydrateOpt = <T extends { geometry?: RouteDraft['geometry'] }>(opt: T): T => ({
    ...opt,
    geometry: geometryFromStored(opt.geometry),
  })
  return {
    ...raw,
    geometry: geometryFromStored(raw.geometry),
    routeOptions: raw.routeOptions?.map(hydrateOpt),
    alternatives: raw.alternatives?.map(hydrateOpt),
  }
}

export async function saveCloudDraft(uid: string, draft: RouteDraft): Promise<void> {
  if (!isFirebaseConfigured()) return
  // Always keep full geometry on-device; cloud gets a lean preview only.
  await saveFullLocal(uid, draft)
  const lean = leanDraft(draft)
  await setDoc(
    doc(getDb(), 'users', uid),
    {
      [FIELD]: lean,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function loadCloudDraft(uid: string): Promise<RouteDraft | null> {
  if (!isFirebaseConfigured()) return null
  const snap = await getDoc(doc(getDb(), 'users', uid))
  if (!snap.exists()) return null
  const raw = snap.data()?.[FIELD]
  if (!raw || typeof raw !== 'object') return null
  const cloud = hydrateCloudDraft(raw as RouteDraft)
  const local = await loadFullLocal(uid)
  if (
    local?.geometry?.coordinates?.length &&
    local.geometry.coordinates.length >= (cloud.geometry?.coordinates?.length ?? 0) &&
    sameRouteIdentity(local, cloud)
  ) {
    return local
  }
  return cloud
}

export async function clearCloudDraft(uid: string): Promise<void> {
  if (!isFirebaseConfigured()) return
  await clearFullLocal(uid)
  await setDoc(
    doc(getDb(), 'users', uid),
    { [FIELD]: null, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/** Preview-only downsample for Firestore size — never the sole source of truth on-device.
 *  Coordinates are stored as {lng,lat} objects (not nested arrays) for Firestore friendliness.
 */
export function leanDraft(draft: RouteDraft): Record<string, unknown> {
  const downsample = (coords: [number, number][]) => {
    if (coords.length <= 800) return coords
    const step = Math.ceil(coords.length / 600)
    return coords.filter((_, i) => i % step === 0 || i === coords.length - 1) as [number, number][]
  }

  const leanGeom = (geometry: RouteDraft['geometry'] | undefined) => {
    const coords = downsample(geometry?.coordinates ?? [])
    return {
      type: 'LineString' as const,
      coordinates: coordsToStored(coords),
    }
  }

  const routeOptions = draft.routeOptions?.map((opt) => ({
    ...opt,
    geometry: leanGeom(opt.geometry),
    elevationProfile: opt.elevationProfile?.filter((_, i) => i % 2 === 0) ?? [],
  }))
  const alternatives = draft.alternatives?.map((opt) => ({
    ...opt,
    geometry: leanGeom(opt.geometry),
    elevationProfile: opt.elevationProfile?.filter((_, i) => i % 2 === 0) ?? [],
  }))

  return {
    ...draft,
    // Cap main geometry similarly to RouteRepository persistence.
    geometry: geometryToStored(
      { type: 'LineString', coordinates: downsample(draft.geometry?.coordinates ?? []) },
      800,
    ),
    elevationProfile: draft.elevationProfile?.filter((_, i) => i % 2 === 0) ?? [],
    routeOptions,
    alternatives,
  }
}
