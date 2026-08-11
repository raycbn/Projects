import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import type { Activity, ActivityStatus, ActivityTrackPoint, BikeType } from '@/domain/types'
import { getDb, isFirebaseConfigured } from '@/lib/firebase'
import { computeElevationStats, normalizeCyclingElevationProfile, pathDistanceMeters } from '@/lib/stats'

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
    startedAt: data.startedAt,
    finishedAt: data.finishedAt,
    track: data.track ?? [],
    stats: data.stats ?? { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0 },
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? new Date().toISOString(),
  }
}

export function computeActivityStats(
  track: ActivityTrackPoint[],
  startedAt: string,
  finishedAt?: string,
  options?: {
    /** Override wall-clock duration (e.g. exclude paused time). */
    durationSeconds?: number
    /** Phone GPS altitude is noisier than DEM — default 3 m vs 10 m for routes. */
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

  // O(n) cumulative distance for the elevation profile (avoid O(n²) slice scans).
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
    options?.elevationThresholdMeters ?? 3,
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

  async listForUser(userId: string): Promise<Activity[]> {
    const q = query(
      collection(getDb(), 'activities'),
      where('userId', '==', userId),
      orderBy('startedAt', 'desc'),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => mapActivity(d.id, d.data()))
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

  async updateTrack(
    activityId: string,
    track: ActivityTrackPoint[],
    stats: Activity['stats'],
    status: ActivityStatus,
    finishedAt?: string,
  ): Promise<void> {
    // Firestore ~1 MiB doc limit — keep a dense-enough but bounded track.
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
