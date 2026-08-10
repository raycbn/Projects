import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
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
import { computeActivityStats } from '@/lib/activityStats'

export { computeActivityStats } from '@/lib/activityStats'

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
    startedAt: data.startedAt,
    finishedAt: data.finishedAt,
    track: data.track ?? [],
    stats: data.stats ?? { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0 },
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? new Date().toISOString(),
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
    const q = query(
      collection(getDb(), 'activities'),
      where('userId', '==', userId),
      orderBy('startedAt', 'desc'),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => mapActivity(d.id, d.data()))
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
      // Missing composite index until owner deploys firestore.indexes.json
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
    const payload = {
      userId: input.userId,
      title: input.title,
      bikeType: input.bikeType,
      routeId: input.routeId,
      source: 'gps' as ActivitySource,
      status: 'recording' as ActivityStatus,
      startedAt,
      track: [] as ActivityTrackPoint[],
      stats: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0 },
      monthKey: monthKeyNow(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const ref = await addDoc(collection(getDb(), 'activities'), payload)
    return mapActivity(ref.id, { ...payload, createdAt: startedAt, updatedAt: startedAt })
  }

  /** Upsert a finished import. Recomputes PedalMap Free analytics from the track. */
  async importFinished(
    userId: string,
    input: Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<{ activity: Activity; created: boolean }> {
    if (input.externalId) {
      const existing = await this.findByExternalId(userId, input.externalId)
      if (existing) return { activity: existing, created: false }
    }
    const track = downsampleTrack(input.track, 3500)
    const now = new Date().toISOString()
    const computed = computeActivityStats(track, input.startedAt, input.finishedAt)
    const stats: Activity['stats'] = {
      ...computed,
      averageHeartRateBpm:
        computed.averageHeartRateBpm ?? input.stats.averageHeartRateBpm,
      averageCadenceRpm: computed.averageCadenceRpm ?? input.stats.averageCadenceRpm,
      averagePowerWatts: computed.averagePowerWatts ?? input.stats.averagePowerWatts,
    }
    const payload = {
      userId,
      title: input.title,
      bikeType: input.bikeType,
      routeId: input.routeId,
      source: input.source ?? 'strava',
      externalId: input.externalId,
      status: 'finished' as ActivityStatus,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      track,
      stats,
      monthKey: monthKeyNow(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
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
    const capped = downsampleTrack(track, 3500)
    await updateDoc(doc(getDb(), 'activities', activityId), {
      track: capped,
      stats,
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
