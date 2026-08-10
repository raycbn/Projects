import {
  addDoc,
  collection,
  doc,
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
  const profile = normalizeCyclingElevationProfile(
    track.map((p, i) => ({
      distanceMeters: i === 0 ? 0 : pathDistanceMeters(positions.slice(0, i + 1)),
      elevationMeters:
        p.elevationMeters !== undefined && Number.isFinite(p.elevationMeters)
          ? p.elevationMeters
          : Number.NaN,
      position: p.position,
    })),
  )
  const elev = computeElevationStats(profile)

  const hrs = track.map((p) => p.heartRateBpm).filter((v): v is number => Number.isFinite(v))
  const cads = track.map((p) => p.cadenceRpm).filter((v): v is number => Number.isFinite(v))
  const watts = track.map((p) => p.powerWatts).filter((v): v is number => Number.isFinite(v))
  const speeds = track
    .map((p) => p.speedMetersPerSecond)
    .filter((v): v is number => Number.isFinite(v))
  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : undefined

  return {
    distanceMeters,
    durationSeconds,
    elevationGainMeters: Math.round(elev.gain),
    averageHeartRateBpm: avg(hrs),
    averageCadenceRpm: avg(cads),
    averagePowerWatts: avg(watts),
    averageSpeedMetersPerSecond: speeds.length
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : undefined,
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

  async findByExternalId(userId: string, externalId: string): Promise<Activity | null> {
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

  /** Upsert a finished import (Strava). Skips if externalId already exists. */
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
      stats: input.stats,
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
