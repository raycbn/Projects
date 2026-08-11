import type { Activity, ActivityTrackPoint } from '@/domain/types'
import {
  computeElevationStats,
  haversineMeters,
  normalizeCyclingElevationProfile,
  pathDistanceMeters,
} from '@/lib/stats'

/** Below this derived speed we treat the rider as stopped (moving-time calc). */
const MOVING_SPEED_MPS = 0.7
/** Gaps longer than this (pause / background) count as stopped, not moving. */
const MAX_MOVING_GAP_SEC = 90

/** Default bike+rider mass for Free estimated power (no scale required). */
const DEFAULT_MASS_KG = 78
const CRR = 0.005
const CDA = 0.32
const RHO = 1.225
const DRIVETRAIN_EFF = 0.97
const G = 9.80665

function avg(arr: number[]): number | undefined {
  if (!arr.length) return undefined
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Instantaneous cycling power estimate (flat aero + rolling + gravity).
 * Free analytics — no power meter required.
 */
export function estimateInstantPowerWatts(speedMps: number, gradeRatio: number): number {
  if (speedMps < 0.3) return 0
  const rolling = CRR * DEFAULT_MASS_KG * G * speedMps
  const aero = 0.5 * CDA * RHO * speedMps ** 3
  const gravity = DEFAULT_MASS_KG * G * gradeRatio * speedMps
  const raw = (rolling + aero + Math.max(0, gravity)) / DRIVETRAIN_EFF
  return Math.max(0, raw)
}

export type ActivitySplit = {
  index: number
  distanceMeters: number
  durationSeconds: number
  averageSpeedMetersPerSecond: number
  elevationGainMeters: number
}

/**
 * PedalMap Free activity analytics — richer than Strava Free basics
 * (moving time, elev loss, grade, VAM, estimated power/kcal, km splits).
 */
export function computeActivityStats(
  track: ActivityTrackPoint[],
  startedAt: string,
  finishedAt?: string,
): Activity['stats'] {
  const positions = track.map((p) => p.position)
  const distanceMeters = Math.round(pathDistanceMeters(positions))
  const start = Date.parse(startedAt)
  const end = Date.parse(finishedAt ?? track.at(-1)?.recordedAt ?? new Date().toISOString())
  const elapsedSeconds = Math.max(0, Math.round((end - start) / 1000))

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

  let movingSeconds = 0
  let stoppedSeconds = 0
  const derivedSpeeds: number[] = []
  const grades: number[] = []
  const powerSamples: number[] = []
  let climbMetersMoving = 0

  for (let i = 1; i < track.length; i += 1) {
    const prev = track[i - 1]
    const cur = track[i]
    const dt = Math.max(0, (Date.parse(cur.recordedAt) - Date.parse(prev.recordedAt)) / 1000)
    if (!Number.isFinite(dt) || dt <= 0) continue

    const segDist = haversineMeters(prev.position, cur.position)
    const gpsSpeed =
      typeof cur.speedMetersPerSecond === 'number' && Number.isFinite(cur.speedMetersPerSecond)
        ? Math.max(0, cur.speedMetersPerSecond)
        : undefined
    const derived = dt > 0 ? segDist / dt : 0
    const speed = gpsSpeed ?? derived

    const elevDelta =
      Number.isFinite(cur.elevationMeters) && Number.isFinite(prev.elevationMeters)
        ? (cur.elevationMeters as number) - (prev.elevationMeters as number)
        : 0
    const grade = segDist > 1 ? elevDelta / segDist : 0

    if (dt <= MAX_MOVING_GAP_SEC && speed >= MOVING_SPEED_MPS) {
      movingSeconds += dt
      derivedSpeeds.push(speed)
      if (Math.abs(grade) < 0.45) grades.push(grade)
      powerSamples.push(estimateInstantPowerWatts(speed, grade))
      if (elevDelta > 0) climbMetersMoving += elevDelta
    } else {
      stoppedSeconds += Math.min(dt, MAX_MOVING_GAP_SEC)
    }
  }

  // If we barely got deltas (sparse GPS), fall back to elapsed.
  if (movingSeconds < 5 && elapsedSeconds > 0 && distanceMeters > 20) {
    movingSeconds = elapsedSeconds
  }

  const deviceSpeeds = track
    .map((p) => p.speedMetersPerSecond)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0)

  const speedPool = deviceSpeeds.length >= 5 ? deviceSpeeds : derivedSpeeds
  const averageSpeed =
    speedPool.length > 0
      ? avg(speedPool)
      : movingSeconds > 0
        ? distanceMeters / movingSeconds
        : undefined
  const maxSpeed = speedPool.length ? Math.max(...speedPool) : undefined

  const hrs = track.map((p) => p.heartRateBpm).filter((v): v is number => Number.isFinite(v))
  const cads = track.map((p) => p.cadenceRpm).filter((v): v is number => Number.isFinite(v))
  const wattsTrack = track.map((p) => p.powerWatts).filter((v): v is number => Number.isFinite(v))

  const measuredPower = avg(wattsTrack)
  const estimatedPower = avg(powerSamples)
  const averagePower = measuredPower ?? estimatedPower

  const averageGradePercent =
    grades.length > 0 ? round1((avg(grades) as number) * 100) : undefined
  const maxGradePercent =
    grades.length > 0 ? round1(Math.max(...grades.map((g) => Math.abs(g))) * 100) : undefined

  const vam =
    movingSeconds > 60 && climbMetersMoving > 5
      ? Math.round((climbMetersMoving / movingSeconds) * 3600)
      : undefined

  // Rough metabolic cost from estimated mechanical work (Free kcal).
  const workKj =
    averagePower && movingSeconds > 0 ? (averagePower * movingSeconds) / 1000 : undefined
  const estimatedCaloriesKcal = workKj
    ? Math.round((workKj / 0.22) / 4.184) // ~22% metabolic efficiency → kcal
    : undefined

  const coastingPercent =
    derivedSpeeds.length > 10
      ? Math.round(
          (100 * derivedSpeeds.filter((s) => s < 2.5 && s >= MOVING_SPEED_MPS).length) /
            derivedSpeeds.length,
        )
      : undefined

  const splits = buildKmSplits(track)

  return {
    distanceMeters,
    durationSeconds: elapsedSeconds,
    movingTimeSeconds: Math.round(movingSeconds),
    stoppedTimeSeconds: Math.round(stoppedSeconds),
    elevationGainMeters: Math.round(elev.gain),
    elevationLossMeters: Math.round(elev.loss),
    elevationHighestMeters:
      elev.highest !== undefined ? Math.round(elev.highest) : undefined,
    elevationLowestMeters: elev.lowest !== undefined ? Math.round(elev.lowest) : undefined,
    averageHeartRateBpm: hrs.length ? Math.round(avg(hrs) as number) : undefined,
    averageCadenceRpm: cads.length ? Math.round(avg(cads) as number) : undefined,
    averagePowerWatts: averagePower !== undefined ? Math.round(averagePower) : undefined,
    estimatedPowerWatts:
      measuredPower === undefined && estimatedPower !== undefined
        ? Math.round(estimatedPower)
        : undefined,
    averageSpeedMetersPerSecond:
      averageSpeed !== undefined ? round1(averageSpeed) : undefined,
    maxSpeedMetersPerSecond: maxSpeed !== undefined ? round1(maxSpeed) : undefined,
    averageGradePercent,
    maxGradePercent,
    vamMetersPerHour: vam,
    estimatedCaloriesKcal,
    coastingPercent,
    splits,
  }
}

function buildKmSplits(track: ActivityTrackPoint[]): ActivitySplit[] | undefined {
  if (track.length < 3) return undefined
  const splits: ActivitySplit[] = []
  let splitStartIdx = 0
  let accum = 0
  let elevGain = 0
  let nextKm = 1000
  let index = 1

  for (let i = 1; i < track.length; i += 1) {
    const d = haversineMeters(track[i - 1].position, track[i].position)
    accum += d
    const e0 = track[i - 1].elevationMeters
    const e1 = track[i].elevationMeters
    if (Number.isFinite(e0) && Number.isFinite(e1) && (e1 as number) > (e0 as number)) {
      elevGain += (e1 as number) - (e0 as number)
    }

    while (accum >= nextKm) {
      const t0 = Date.parse(track[splitStartIdx].recordedAt)
      const t1 = Date.parse(track[i].recordedAt)
      const durationSeconds = Math.max(1, Math.round((t1 - t0) / 1000))
      splits.push({
        index,
        distanceMeters: 1000,
        durationSeconds,
        averageSpeedMetersPerSecond: round1(1000 / durationSeconds),
        elevationGainMeters: Math.round(elevGain),
      })
      index += 1
      nextKm += 1000
      splitStartIdx = i
      elevGain = 0
    }
  }

  return splits.length ? splits : undefined
}
