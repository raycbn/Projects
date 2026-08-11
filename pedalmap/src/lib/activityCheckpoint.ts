import type { ActivityTrackPoint, ActivityStatus, BikeType } from '@/domain/types'

const PREFIX = 'pedalmap_activity_ckpt_'

export type ActivityCheckpoint = {
  activityId: string
  userId: string
  title: string
  bikeType: BikeType
  routeId?: string
  startedAt: string
  status: ActivityStatus
  track: ActivityTrackPoint[]
  /** Accumulated paused duration so restore keeps Tiempo accurate. */
  pausedMs?: number
  updatedAt: string
}

function key(activityId: string): string {
  return `${PREFIX}${activityId}`
}

export function saveActivityCheckpoint(checkpoint: ActivityCheckpoint): void {
  try {
    const lean: ActivityCheckpoint = {
      ...checkpoint,
      // Cap local storage size for very long rides
      track: checkpoint.track.length > 4000 ? checkpoint.track.slice(-4000) : checkpoint.track,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(key(checkpoint.activityId), JSON.stringify(lean))
    localStorage.setItem(`${PREFIX}latest`, checkpoint.activityId)
  } catch (error) {
    console.warn('[activityCheckpoint] save failed', error)
  }
}

export function loadActivityCheckpoint(activityId: string): ActivityCheckpoint | null {
  try {
    const raw = localStorage.getItem(key(activityId))
    if (!raw) return null
    return JSON.parse(raw) as ActivityCheckpoint
  } catch {
    return null
  }
}

export function loadLatestActivityCheckpoint(): ActivityCheckpoint | null {
  try {
    const id = localStorage.getItem(`${PREFIX}latest`)
    if (!id) return null
    return loadActivityCheckpoint(id)
  } catch {
    return null
  }
}

export function clearActivityCheckpoint(activityId: string): void {
  try {
    localStorage.removeItem(key(activityId))
    const latest = localStorage.getItem(`${PREFIX}latest`)
    if (latest === activityId) localStorage.removeItem(`${PREFIX}latest`)
  } catch {
    /* ignore */
  }
}
