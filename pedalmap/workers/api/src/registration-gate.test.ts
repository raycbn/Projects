import { describe, expect, it } from 'vitest'
import type { FirebaseIdentity } from './firebaseAuth'
import { requireRegisteredAccount } from './index'

function identity(isAnonymous: boolean): FirebaseIdentity {
  return {
    uid: isAnonymous ? 'guest-uid' : 'registered-uid',
    email: isAnonymous ? undefined : 'rider@example.com',
    emailVerified: !isAnonymous,
    isAnonymous,
  }
}

describe('registered-account feature gate', () => {
  it('blocks anonymous users from account-only route publishing and wind alerts', async () => {
    const response = requireRegisteredAccount(identity(true))

    expect(response).not.toBeNull()
    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toMatchObject({
      code: 'registration_required',
    })
  })

  it('allows registered Free and Premium accounts through the account gate', () => {
    expect(requireRegisteredAccount(identity(false))).toBeNull()
  })
})
