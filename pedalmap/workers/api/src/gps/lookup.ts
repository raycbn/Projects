import { readGpsUidByProviderUser, type GpsProvider } from '../firestore'
import type { Env } from '../types'

export async function resolveUidForProviderUser(
  env: Env,
  provider: GpsProvider,
  externalUserId: string,
): Promise<string | null> {
  return readGpsUidByProviderUser(env, provider, externalUserId)
}
