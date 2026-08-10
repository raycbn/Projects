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
import { computeElevationStats, pathDistanceMeters } from '@/lib/stats'

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
): Activity['stats'] {
  const positions = track.map((p) => p.position)
  const distanceMeters = Math.round(pathDistanceMeters(positions))
  const start = Date.parse(startedAt)
  const end = Date.parse(finishedAt ?? new Date().toISOString())
  const durationSeconds = Math.max(0, Math.round((end - start) / 1000))
  const profile = track.map((p, i) => ({
    distanceMeters: i === 0 ? 0 : pathDistanceMeters(positions.slice(0, i + 1)),
    elevationMeters: p.elevationMeters ?? 0,
    position: p.position,
  }))
  const elev = computeElevationStats(profile)
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
    const payload = {
      userId: input.userId,
      title: input.title,
      bikeType: input.bikeType,
      routeId: input.routeId,
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

  async updateTrack(
    activityId: string,
    track: ActivityTrackPoint[],
    stats: Activity['stats'],
    status: ActivityStatus,
    finishedAt?: string,
  ): Promise<void> {
    await updateDoc(doc(getDb(), 'activities', activityId), {
      track,
      stats,
      status,
      ...(finishedAt ? { finishedAt } : {}),
      updatedAt: serverTimestamp(),
    })
  }
}

export const activityRepository = new ActivityRepository()
