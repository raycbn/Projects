import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import type { RouteDraft, SavedRoute } from '@/domain/types'
import { FREE_LIMITS } from '@/domain/types'
import { getDb, isFirebaseConfigured } from '@/lib/firebase'
import { createShareSlug } from '@/lib/share'
import { routingAuthHeaders } from '@/lib/routingAuth'

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function toIso(value: Timestamp | string | undefined): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  return value.toDate().toISOString()
}

/** Firestore rejects `undefined` field values — strip recursively before writes. */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue
      if (typeof nested === 'number' && !Number.isFinite(nested)) continue
      out[key] = stripUndefinedDeep(nested)
    }
    return out as T
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return 0 as T
  }
  return value
}

function downsampleCoords(
  coords: [number, number][],
  maxPoints: number,
): [number, number][] {
  if (coords.length <= maxPoints) return coords
  const out: [number, number][] = []
  const step = (coords.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.min(coords.length - 1, Math.round(i * step))
    out.push(coords[idx]!)
  }
  return out
}

function downsampleElevation<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points
  const out: T[] = []
  const step = (points.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.min(points.length - 1, Math.round(i * step))
    out.push(points[idx]!)
  }
  return out
}

/** Firestore forbids nested arrays — store LineString coords as objects. */
export type StoredLngLat = { lng: number; lat: number }

export function coordsToStored(coords: [number, number][]): StoredLngLat[] {
  return coords
    .map(([lng, lat]) => ({ lng: Number(lng), lat: Number(lat) }))
    .filter((c) => Number.isFinite(c.lng) && Number.isFinite(c.lat))
}

export function coordsFromStored(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return []
  const out: [number, number][] = []
  for (const item of raw) {
    if (Array.isArray(item) && item.length >= 2) {
      const lng = Number(item[0])
      const lat = Number(item[1])
      if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat])
      continue
    }
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>
      const lng = Number(rec.lng ?? rec[0])
      const lat = Number(rec.lat ?? rec[1])
      if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat])
    }
  }
  return out
}

export function geometryToStored(
  geometry: { type?: string; coordinates?: [number, number][] } | undefined,
  maxPoints: number,
): { type: 'LineString'; coordinates: StoredLngLat[] } {
  const coords = downsampleCoords(
    (geometry?.coordinates ?? []) as [number, number][],
    maxPoints,
  )
  return { type: 'LineString', coordinates: coordsToStored(coords) }
}

export function geometryFromStored(raw: unknown): SavedRoute['geometry'] {
  const data = (raw && typeof raw === 'object' ? raw : {}) as {
    type?: string
    coordinates?: unknown
  }
  return {
    type: 'LineString',
    coordinates: coordsFromStored(data.coordinates),
  }
}

/**
 * Persist only what the shared/saved route page needs.
 * Drop bulky alternative options (duplicate geometries) that often blow the 1 MiB doc limit.
 */
export function toPersistedDraft(draft: RouteDraft): Record<string, unknown> {
  const title = String(draft.title || 'Ruta').slice(0, 120)
  const surfaceEdges = (draft.surfaceEdges ?? [])
    .slice(0, 400)
    .map((e) => ({
      length: e.length,
      surface: e.surface,
      road_class: e.road_class,
      use: e.use,
      cycle_lane: e.cycle_lane,
    }))
  return stripUndefinedDeep({
    title,
    description: draft.description,
    type: draft.type,
    bikeType: draft.bikeType,
    preferences: draft.preferences ?? [],
    waypoints: draft.waypoints ?? [],
    geometry: geometryToStored(draft.geometry, 4000),
    elevationProfile: downsampleElevation(draft.elevationProfile ?? [], 800),
    stats: draft.stats,
    circularDistanceMeters: draft.circularDistanceMeters,
    targetElevationGainMeters: draft.targetElevationGainMeters,
    circularSeed: draft.circularSeed,
    // Keep turn-by-turn for navigation after Abrir (cap size).
    instructions: (draft.instructions ?? []).slice(0, 120),
    // Lean surface attrs so Abrir guardada keeps the paint overlay.
    surfaceEdges: surfaceEdges.length ? surfaceEdges : undefined,
    selectedOptionId: draft.selectedOptionId,
  })
}

/** Slim payload for Worker Admin publish (WhatsApp share). */
export function toSharePublishPayload(
  draft: RouteDraft,
  options?: { routeId?: string | null },
): Record<string, unknown> {
  const persisted = toPersistedDraft(draft)
  return stripUndefinedDeep({
    ...persisted,
    // Even slimmer for the API body.
    elevationProfile: downsampleElevation(
      (persisted.elevationProfile as unknown[]) ?? [],
      400,
    ),
    geometry: geometryToStored(draft.geometry, 2500),
    routeId: options?.routeId || undefined,
  })
}

function firestoreErrorMessage(error: unknown): string {
  if (!error) return 'unknown'
  if (typeof error === 'string' && error.trim()) return error
  if (typeof error === 'object') {
    const e = error as { code?: string; message?: string; name?: string }
    const parts = [e.code, e.message || e.name].filter((p) => typeof p === 'string' && p.trim())
    if (parts.length) return parts.join(' · ')
  }
  if (error instanceof Error && error.message) return error.message
  try {
    return JSON.stringify(error).slice(0, 200)
  } catch {
    return 'unknown'
  }
}

function apiBase(): string | undefined {
  const proxy =
    import.meta.env.VITE_PEDALMAP_API_URL || import.meta.env.VITE_ROUTING_PROXY_URL
  if (typeof proxy !== 'string' || !proxy.trim()) return undefined
  return proxy.trim().replace(/\/+$/, '')
}

export class RouteRepository {
  isConfigured(): boolean {
    return isFirebaseConfigured()
  }

  async listByUser(userId: string): Promise<SavedRoute[]> {
    const q = query(collection(getDb(), 'routes'), where('userId', '==', userId))
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => this.mapDoc(d.id, d.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async listPublic(max = 40): Promise<SavedRoute[]> {
    const q = query(
      collection(getDb(), 'routes'),
      where('isPublic', '==', true),
    )
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => this.mapDoc(d.id, d.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, max)
  }

  async getById(routeId: string): Promise<SavedRoute | null> {
    const snap = await getDoc(doc(getDb(), 'routes', routeId))
    if (!snap.exists()) return null
    return this.mapDoc(snap.id, snap.data())
  }

  async getByShareSlug(shareSlug: string): Promise<SavedRoute | null> {
    // Prefer routeShares lookup — no composite index required; public-readable.
    try {
      const shareSnap = await getDoc(doc(getDb(), 'routeShares', shareSlug))
      if (shareSnap.exists()) {
        const data = shareSnap.data() as Record<string, unknown>
        const routeId = String(data.routeId || '')
        if (routeId) {
          const route = await this.getById(routeId)
          if (route?.isPublic) return route
        }
        // Embedded snapshot (Worker publish) — enough to render /route/:slug.
        if (data.geometry && data.stats && data.waypoints) {
          return this.mapDoc(routeId || shareSlug, {
            ...data,
            userId: String(data.userId || 'public'),
            isPublic: true,
            shareSlug,
          })
        }
      }
    } catch (err) {
      console.warn('[routes] routeShares lookup', err)
    }

    // Fallback for older shares / missing routeShares doc.
    try {
      const q = query(
        collection(getDb(), 'routes'),
        where('shareSlug', '==', shareSlug),
        where('isPublic', '==', true),
      )
      const snap = await getDocs(q)
      const first = snap.docs[0]
      if (!first) return null
      return this.mapDoc(first.id, first.data())
    } catch (err) {
      console.warn('[routes] shareSlug query', err)
      return null
    }
  }

  /**
   * Publish a public share link via Worker Admin (bypasses client rule quirks).
   * Falls back to direct Firestore if the Worker is unavailable.
   */
  async publishForShare(
    userId: string,
    draft: RouteDraft,
    options?: { routeId?: string | null },
  ): Promise<{ shareSlug: string; routeId: string }> {
    const payload = toSharePublishPayload(draft, { routeId: options?.routeId })
    const base = apiBase()
    if (base) {
      try {
        const res = await fetch(`${base}/routes/publish`, {
          method: 'POST',
          headers: await routingAuthHeaders(),
          body: JSON.stringify(payload),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          shareSlug?: string
          routeId?: string
          error?: string
          code?: string
        }
        if (res.ok && body.shareSlug && body.routeId) {
          return { shareSlug: body.shareSlug, routeId: body.routeId }
        }
        const detail = body.error || body.code || `http_${res.status}`
        console.warn('[routes] worker publish failed', detail)
        // Auth / validation errors should not silently fall back.
        if (res.status === 401 || res.status === 400) {
          throw new Error(`save_failed:${detail}`)
        }
        throw new Error(`worker_publish:${detail}`)
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('save_failed:')) throw error
        console.warn('[routes] worker publish error, falling back to client', error)
      }
    }

    // Client fallback (older deploys / Worker down).
    if (options?.routeId) {
      const shareSlug = await this.makePublic(options.routeId, userId)
      return { shareSlug, routeId: options.routeId }
    }
    const saved = await this.save(userId, draft, { isPublic: true })
    if (!saved.shareSlug) throw new Error('missing_slug')
    return { shareSlug: saved.shareSlug, routeId: saved.id }
  }

  /**
   * Transactional save: enforce Free save cap + bump usage.routesSaved atomically.
   * Firestore rules also reject creates over the Free limit.
   */
  async save(userId: string, draft: RouteDraft, options?: { isPublic?: boolean }): Promise<SavedRoute> {
    const shareSlug = createShareSlug(draft.title)
    const db = getDb()
    const userRef = doc(db, 'users', userId)
    const routeRef = doc(collection(db, 'routes'))
    const isPublic = options?.isPublic ?? false
    const nowIso = new Date().toISOString()
    const payload = toPersistedDraft(draft)

    try {
      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const usage = (userSnap.data()?.usage as
          | { routesCreatedThisMonth?: number; routesSaved?: number; monthKey?: string }
          | undefined) ?? {
          routesCreatedThisMonth: 0,
          routesSaved: 0,
          monthKey: monthKey(),
        }
        const plan = (userSnap.data()?.plan as 'free' | 'premium' | undefined) ?? 'free'
        const saved = usage.routesSaved ?? 0
        if (plan !== 'premium' && saved >= FREE_LIMITS.maxRoutesSaved) {
          throw new Error('save_limit')
        }

        tx.set(routeRef, {
          ...payload,
          userId,
          isPublic,
          shareSlug,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        tx.set(
          userRef,
          {
            usage: {
              routesCreatedThisMonth: usage.routesCreatedThisMonth ?? 0,
              routesSaved: saved + 1,
              monthKey: usage.monthKey ?? monthKey(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'save_limit') throw error
      console.error('[routes] save failed', firestoreErrorMessage(error), error)
      throw new Error(`save_failed:${firestoreErrorMessage(error)}`)
    }

    if (isPublic) {
      try {
        await setDoc(doc(db, 'routeShares', shareSlug), {
          routeId: routeRef.id,
          userId,
          createdAt: serverTimestamp(),
        })
      } catch (error) {
        console.error('[routes] routeShares write failed', firestoreErrorMessage(error), error)
        throw new Error(`save_failed:${firestoreErrorMessage(error)}`)
      }
    }

    return {
      ...draft,
      title: String(payload.title || draft.title),
      id: routeRef.id,
      userId,
      isPublic,
      shareSlug,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
  }

  async update(routeId: string, userId: string, draft: Partial<RouteDraft> | RouteDraft): Promise<void> {
    const ref = doc(getDb(), 'routes', routeId)
    const existing = await getDoc(ref)
    if (!existing.exists() || existing.data().userId !== userId) {
      throw new Error('No tienes permiso para editar esta ruta')
    }
    const payload =
      'geometry' in draft && draft.geometry
        ? toPersistedDraft(draft as RouteDraft)
        : stripUndefinedDeep(draft)
    await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() })
  }

  async duplicate(userId: string, route: SavedRoute): Promise<SavedRoute> {
    const draft: RouteDraft = {
      title: `${route.title} (copia)`,
      description: route.description,
      type: route.type,
      bikeType: route.bikeType,
      preferences: route.preferences,
      waypoints: route.waypoints,
      geometry: route.geometry,
      elevationProfile: route.elevationProfile,
      stats: route.stats,
      circularDistanceMeters: route.circularDistanceMeters,
    }
    return this.save(userId, draft)
  }

  /** Delete route + decrement usage.routesSaved in one transaction. */
  async remove(routeId: string, userId: string): Promise<void> {
    const db = getDb()
    const routeRef = doc(db, 'routes', routeId)
    const userRef = doc(db, 'users', userId)
    let slug: string | undefined

    await runTransaction(db, async (tx) => {
      const existing = await tx.get(routeRef)
      if (!existing.exists() || existing.data().userId !== userId) {
        throw new Error('No tienes permiso para eliminar esta ruta')
      }
      slug = existing.data().shareSlug as string | undefined
      const userSnap = await tx.get(userRef)
      const usage = (userSnap.data()?.usage as
        | { routesCreatedThisMonth?: number; routesSaved?: number; monthKey?: string }
        | undefined) ?? {
        routesCreatedThisMonth: 0,
        routesSaved: 0,
        monthKey: monthKey(),
      }
      tx.delete(routeRef)
      tx.set(
        userRef,
        {
          usage: {
            routesCreatedThisMonth: usage.routesCreatedThisMonth ?? 0,
            routesSaved: Math.max(0, (usage.routesSaved ?? 0) - 1),
            monthKey: usage.monthKey ?? monthKey(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    })

    if (slug) {
      await deleteDoc(doc(db, 'routeShares', slug)).catch(() => undefined)
    }
  }

  async makePublic(routeId: string, userId: string): Promise<string> {
    const ref = doc(getDb(), 'routes', routeId)
    const existing = await getDoc(ref)
    if (!existing.exists() || existing.data().userId !== userId) {
      throw new Error('No tienes permiso para compartir esta ruta')
    }
    const shareSlug = (existing.data().shareSlug as string) || createShareSlug(existing.data().title)
    try {
      await updateDoc(ref, { isPublic: true, shareSlug, updatedAt: serverTimestamp() })
      await setDoc(doc(getDb(), 'routeShares', shareSlug), {
        routeId,
        userId,
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      console.error('[routes] makePublic failed', firestoreErrorMessage(error), error)
      throw new Error(`save_failed:${firestoreErrorMessage(error)}`)
    }
    return shareSlug
  }

  currentMonthKey(): string {
    return monthKey()
  }

  private mapDoc(id: string, data: Record<string, unknown>): SavedRoute {
    return {
      id,
      userId: String(data.userId),
      title: String(data.title ?? 'Ruta'),
      description: data.description ? String(data.description) : undefined,
      type: (data.type as SavedRoute['type']) ?? 'a_to_b',
      bikeType: (data.bikeType as SavedRoute['bikeType']) ?? 'road',
      preferences: (data.preferences as SavedRoute['preferences']) ?? [],
      waypoints: (data.waypoints as SavedRoute['waypoints']) ?? [],
      geometry: geometryFromStored(data.geometry),
      elevationProfile: (data.elevationProfile as SavedRoute['elevationProfile']) ?? [],
      stats: data.stats as SavedRoute['stats'],
      circularDistanceMeters: data.circularDistanceMeters as number | undefined,
      isPublic: Boolean(data.isPublic),
      shareSlug: data.shareSlug ? String(data.shareSlug) : undefined,
      createdAt: toIso(data.createdAt as Timestamp | string | undefined),
      updatedAt: toIso(data.updatedAt as Timestamp | string | undefined),
    }
  }
}

export const routeRepository = new RouteRepository()
