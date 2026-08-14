import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import type {
  Activity,
  ActivitySource,
  ActivityStatus,
  ActivityTrackPoint,
  BikeType,
} from '@/domain/types'
import { getDb, isFirebaseConfigured } from '@/lib/firebase'
import { computeActivityStats as computeRichActivityStats } from '@/lib/activityStats'
import { computeElevationStats, CYCLING_ELEVATION_THRESHOLD_M, normalizeCyclingElevationProfile, pathDistanceMeters } from '@/lib/stats'
import { stripUndefinedDeep } from '@/services/RouteRepository'

function monthKeyNow(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function mapActivity(id: string, data: DocumentData): Activity {
  return {
    id,
    userId: data.userId,
    routeId: data.routeId,
    title: data.title,
    status: data.status,
    bikeType: data.bikeType,
    source: data.source as ActivitySource | undefined,
    externalId: data.externalId ? String(data.externalId) : undefined,
    isPublic: data.isPublic === true,
    startedAt: data.startedAt,
    finishedAt: data.finishedAt,
    track: data.track ?? [],
    stats: data.stats ?? { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0 },
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? new Date().toISOString(),
  }
}

/** Live-recording stats (supports pause-aware duration override). */
export function computeActivityStats(
  track: ActivityTrackPoint[],
  startedAt: string,
  finishedAt?: string,
  options?: {
    /** Override wall-clock duration (e.g. exclude paused time). */
    durationSeconds?: number
    /** Defaults to the shared GPS-like cycling threshold. */
    elevationThresholdMeters?: number
  },
): Activity['stats'] {
  const positions = track.map((p) => p.position)
  const distanceMeters = Math.round(pathDistanceMeters(positions))
  const start = Date.parse(startedAt)
  const end = Date.parse(finishedAt ?? new Date().toISOString())
  const durationSeconds =
    options?.durationSeconds !== undefined
      ? Math.max(0, Math.round(options.durationSeconds))
      : Math.max(0, Math.round((end - start) / 1000))

  let cum = 0
  const profile = normalizeCyclingElevationProfile(
    track.map((p, i) => {
      if (i > 0) cum += pathDistanceMeters([positions[i - 1], positions[i]])
      return {
        distanceMeters: cum,
        elevationMeters:
          p.elevationMeters !== undefined && Number.isFinite(p.elevationMeters)
            ? p.elevationMeters
            : Number.NaN,
        position: p.position,
      }
    }),
  )
  const elev = computeElevationStats(
    profile,
    options?.elevationThresholdMeters ?? CYCLING_ELEVATION_THRESHOLD_M,
  )
  return {
    distanceMeters,
    durationSeconds,
    elevationGainMeters: Math.round(elev.gain),
  }
}

export class ActivityRepository {
  isConfigured(): boolean {
    return isFirebaseConfigured()
  }

  async getById(activityId: string): Promise<Activity | null> {
    const snap = await getDoc(doc(getDb(), 'activities', activityId))
    if (!snap.exists()) return null
    return mapActivity(snap.id, snap.data())
  }

  async listForUser(userId: string): Promise<Activity[]> {
    try {
      const q = query(
        collection(getDb(), 'activities'),
        where('userId', '==', userId),
        orderBy('startedAt', 'desc'),
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => mapActivity(d.id, d.data()))
    } catch (err) {
      console.warn('[activities] listForUser ordered query failed', err)
      const q = query(collection(getDb(), 'activities'), where('userId', '==', userId))
      const snap = await getDocs(q)
      return snap.docs
        .map((d) => mapActivity(d.id, d.data()))
        .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    }
  }

  /** Public finished activities for a cyclist profile (opt-in). */
  async listPublicForUser(userId: string, max = 10): Promise<Activity[]> {
    try {
      const q = query(
        collection(getDb(), 'activities'),
        where('userId', '==', userId),
        where('isPublic', '==', true),
        limit(Math.max(max, 20)),
      )
      const snap = await getDocs(q)
      return snap.docs
        .map((d) => mapActivity(d.id, d.data()))
        .filter((a) => a.status === 'finished')
        .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
        .slice(0, max)
    } catch (err) {
      console.warn('[activities] listPublicForUser composite failed, falling back', err)
      try {
        const all = await this.listForUser(userId)
        return all
          .filter((a) => a.isPublic === true && a.status === 'finished')
          .slice(0, max)
      } catch {
        return []
      }
    }
  }

  async setPublic(activityId: string, isPublic: boolean): Promise<void> {
    await setDoc(doc(getDb(), 'activities', activityId), { isPublic, updatedAt: serverTimestamp() }, { merge: true })
  }

  async remove(activityId: string, userId: string): Promise<void> {
    const ref = doc(getDb(), 'activities', activityId)
    const snap = await getDoc(ref)
    if (!snap.exists() || snap.data().userId !== userId) {
      throw new Error('No tienes permiso para eliminar esta salida')
    }
    await deleteDoc(ref)
  }

  async findByExternalId(userId: string, externalId: string): Promise<Activity | null> {
    try {
      const q = query(
        collection(getDb(), 'activities'),
        where('userId', '==', userId),
        where('externalId', '==', externalId),
        limit(1),
      )
      const snap = await getDocs(q)
      const first = snap.docs[0]
      if (!first) return null
      return mapActivity(first.id, first.data())
    } catch (err) {
      console.warn('[activities] findByExternalId', err)
      return null
    }
  }

  async create(input: {
    userId: string
    title: string
    bikeType: BikeType
    routeId?: string
  }): Promise<Activity> {
    const startedAt = new Date().toISOString()
    const payload: Record<string, unknown> = {
      userId: input.userId,
      title: input.title.slice(0, 120),
      bikeType: input.bikeType,
      source: 'gps' as ActivitySource,
      status: 'recording' as ActivityStatus,
      startedAt,
      track: [] as ActivityTrackPoint[],
      stats: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0 },
      monthKey: monthKeyNow(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    // Firestore rejects `undefined` field values — only include routeId when present.
    if (input.routeId) payload.routeId = input.routeId

    const ref = await addDoc(collection(getDb(), 'activities'), payload)
    return mapActivity(ref.id, { ...payload, createdAt: startedAt, updatedAt: startedAt })
  }

  /** Upsert a finished import. Recomputes PedalMap Free analytics from the track. */
  async importFinished(
    userId: string,
    input: Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<{ activity: Activity; created: boolean }> {
    // Gain/loss from the full recording — downsample is only for Firestore size.
    const computed = computeRichActivityStats(input.track, input.startedAt, input.finishedAt)
    const stats = stripUndefinedDeep({
      ...computed,
      averageHeartRateBpm: computed.averageHeartRateBpm ?? input.stats.averageHeartRateBpm,
      averageCadenceRpm: computed.averageCadenceRpm ?? input.stats.averageCadenceRpm,
      averagePowerWatts: computed.averagePowerWatts ?? input.stats.averagePowerWatts,
    } satisfies Activity['stats'])
    const track = stripUndefinedDeep(downsampleTrack(input.track, 3500))
    const now = new Date().toISOString()

    if (input.externalId) {
      const existing = await this.findByExternalId(userId, input.externalId)
      if (existing) {
        await updateDoc(doc(getDb(), 'activities', existing.id), {
          track,
          stats,
          updatedAt: serverTimestamp(),
        })
        return {
          activity: { ...existing, track, stats, updatedAt: now },
          created: false,
        }
      }
    }

    const payload: Record<string, unknown> = {
      userId,
      title: input.title,
      bikeType: input.bikeType,
      source: input.source ?? 'strava',
      status: 'finished' as ActivityStatus,
      startedAt: input.startedAt,
      track,
      stats,
      monthKey: monthKeyNow(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    if (input.finishedAt) payload.finishedAt = input.finishedAt
    if (input.routeId) payload.routeId = input.routeId
    if (input.externalId) payload.externalId = input.externalId
    if (input.isPublic === true) payload.isPublic = true

    const ref = await addDoc(collection(getDb(), 'activities'), payload)
    return {
      activity: mapActivity(ref.id, { ...payload, createdAt: now, updatedAt: now }),
      created: true,
    }
  }

  async updateTrack(
    activityId: string,
    track: ActivityTrackPoint[],
    stats: Activity['stats'],
    status: ActivityStatus,
    finishedAt?: string,
  ): Promise<void> {
    const capped = stripUndefinedDeep(downsampleTrack(track, 3500))
    await updateDoc(doc(getDb(), 'activities', activityId), {
      track: capped,
      stats: stripUndefinedDeep(stats),
      status,
      ...(finishedAt ? { finishedAt } : {}),
      updatedAt: serverTimestamp(),
    })
  }
}

/** Keep first/last + evenly spaced samples so long rides fit under Firestore size. */
export function downsampleTrack(
  track: ActivityTrackPoint[],
  maxPoints: number,
): ActivityTrackPoint[] {
  if (track.length <= maxPoints) return track
  const step = Math.ceil(track.length / maxPoints)
  const out: ActivityTrackPoint[] = []
  for (let i = 0; i < track.length; i += step) out.push(track[i])
  const last = track[track.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

export const activityRepository = new ActivityRepository()
