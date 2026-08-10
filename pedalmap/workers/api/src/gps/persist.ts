import {
  findActivityByExternalId,
  writeImportedActivity,
  type GpsProvider,
} from '../firestore'

/** Shared helper used by providers after normalizing a workout. */
export async function persistProviderActivity(
  env: import('../types').Env,
  uid: string,
  input: {
    provider: GpsProvider
    externalId: string
    title: string
    bikeType: 'road' | 'mtb' | 'gravel' | 'urban' | 'ebike'
    startedAt: string
    finishedAt?: string
    track: Array<{
      position: { lat: number; lng: number }
      elevationMeters?: number
      recordedAt: string
      heartRateBpm?: number
      cadenceRpm?: number
      powerWatts?: number
      speedMetersPerSecond?: number
    }>
    stats: Record<string, unknown>
  },
): Promise<{ created: boolean; activityId: string }> {
  const existing = await findActivityByExternalId(env, uid, input.externalId)
  if (existing) return { created: false, activityId: existing }
  const activityId = await writeImportedActivity(env, uid, {
    title: input.title,
    bikeType: input.bikeType,
    source: input.provider,
    externalId: input.externalId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    track: input.track,
    stats: input.stats,
  })
  return { created: true, activityId }
}
