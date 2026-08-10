/**
 * Persist planner draft to the signed-in user's Firestore profile.
 * Spark-friendly: no Cloud Functions.
 */
import { doc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore'
import type { RouteDraft } from '@/domain/types'
import { getDb, isFirebaseConfigured } from '@/lib/firebase'

const FIELD = 'plannerDraft'

export async function saveCloudDraft(uid: string, draft: RouteDraft): Promise<void> {
  if (!isFirebaseConfigured()) return
  // Keep payload lean — drop ultra-dense coords if huge
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
  return raw as RouteDraft
}

export async function clearCloudDraft(uid: string): Promise<void> {
  if (!isFirebaseConfigured()) return
  await setDoc(
    doc(getDb(), 'users', uid),
    { [FIELD]: null, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

function leanDraft(draft: RouteDraft): RouteDraft {
  const downsample = (coords: [number, number][]) => {
    if (coords.length <= 800) return coords
    const step = Math.ceil(coords.length / 600)
    return coords.filter((_, i) => i % step === 0 || i === coords.length - 1) as [number, number][]
  }

  const geometryCoords = downsample(draft.geometry?.coordinates ?? [])
  const routeOptions = draft.routeOptions?.map((opt) => ({
    ...opt,
    geometry: {
      type: 'LineString' as const,
      coordinates: downsample(opt.geometry.coordinates),
    },
    elevationProfile: opt.elevationProfile?.filter((_, i) => i % 2 === 0) ?? [],
  }))
  const alternatives = draft.alternatives?.map((opt) => ({
    ...opt,
    geometry: {
      type: 'LineString' as const,
      coordinates: downsample(opt.geometry.coordinates),
    },
    elevationProfile: opt.elevationProfile?.filter((_, i) => i % 2 === 0) ?? [],
  }))

  return {
    ...draft,
    geometry: { type: 'LineString', coordinates: geometryCoords },
    elevationProfile: draft.elevationProfile?.filter((_, i) => i % 2 === 0) ?? [],
    routeOptions,
    alternatives,
  }
}
