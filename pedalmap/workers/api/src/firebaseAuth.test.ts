import { describe, expect, it } from 'vitest'
import type { JWTPayload } from 'jose'
import { firebaseIdentityFromPayload } from './firebaseAuth'

function identity(payload: Record<string, unknown>) {
  return firebaseIdentityFromPayload(payload as JWTPayload)
}

describe('Firebase linked identity classification', () => {
  it('keeps a true anonymous account classified as a guest', () => {
    expect(
      identity({
        sub: 'anonymous-uid',
        firebase: { sign_in_provider: 'anonymous', identities: {} },
      }),
    ).toMatchObject({
      uid: 'anonymous-uid',
      isAnonymous: true,
      email: undefined,
    })
  })

  it('recognizes an email-linked anonymous UID as a registered account', () => {
    expect(
      identity({
        sub: 'preserved-uid',
        email: 'rider@example.com',
        email_verified: true,
        firebase: {
          sign_in_provider: 'anonymous',
          identities: { email: ['rider@example.com'] },
        },
      }),
    ).toMatchObject({
      uid: 'preserved-uid',
      email: 'rider@example.com',
      emailVerified: true,
      isAnonymous: false,
    })
  })

  it('recognizes a Google-linked anonymous UID even if the provider claim remains anonymous', () => {
    expect(
      identity({
        sub: 'preserved-google-uid',
        firebase: {
          sign_in_provider: 'anonymous',
          identities: { 'google.com': ['google-subject'] },
        },
      }),
    ).toMatchObject({
      uid: 'preserved-google-uid',
      isAnonymous: false,
    })
  })

  it('recognizes a regular password account as registered', () => {
    expect(
      identity({
        sub: 'email-uid',
        email: 'rider@example.com',
        firebase: { sign_in_provider: 'password', identities: { email: ['rider@example.com'] } },
      }),
    ).toMatchObject({
      uid: 'email-uid',
      email: 'rider@example.com',
      isAnonymous: false,
    })
  })
})
