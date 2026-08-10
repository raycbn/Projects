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

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function toIso(value: Timestamp | string | undefined): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  return value.toDate().toISOString()
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
    const q = query(
      collection(getDb(), 'routes'),
      where('shareSlug', '==', shareSlug),
      where('isPublic', '==', true),
    )
    const snap = await getDocs(q)
    const first = snap.docs[0]
    if (!first) return null
    return this.mapDoc(first.id, first.data())
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
        ...draft,
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

    if (isPublic) {
      await setDoc(doc(db, 'routeShares', shareSlug), {
        routeId: routeRef.id,
        userId,
        createdAt: serverTimestamp(),
      })
    }

    return {
      ...draft,
      id: routeRef.id,
      userId,
      isPublic,
      shareSlug,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
  }

  async update(routeId: string, userId: string, draft: Partial<RouteDraft>): Promise<void> {
    const ref = doc(getDb(), 'routes', routeId)
    const existing = await getDoc(ref)
    if (!existing.exists() || existing.data().userId !== userId) {
      throw new Error('No tienes permiso para editar esta ruta')
    }
    await updateDoc(ref, { ...draft, updatedAt: serverTimestamp() })
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
    await updateDoc(ref, { isPublic: true, shareSlug, updatedAt: serverTimestamp() })
    await setDoc(doc(getDb(), 'routeShares', shareSlug), {
      routeId,
      userId,
      createdAt: serverTimestamp(),
    })
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
      geometry: data.geometry as SavedRoute['geometry'],
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
