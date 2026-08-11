import { describe, expect, it } from 'vitest'
import { googleOAuthClientId } from '@/lib/googleIdentity'

describe('googleOAuthClientId', () => {
  it('returns the Firebase Google web client by default', () => {
    expect(googleOAuthClientId()).toContain('.apps.googleusercontent.com')
  })
})
