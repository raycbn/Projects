import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingAuthAction,
  consumePendingAuthAction,
  googleBridgeReturnUrl,
  isAllowedAuthReturnPath,
  peekPendingAuthAction,
  pendingAuthTrackProps,
  postLoginPath,
  setPendingAuthAction,
} from './pendingAuthAction'

describe('pendingAuthAction', () => {
  beforeEach(() => {
    clearPendingAuthAction()
    sessionStorage.clear()
  })

  afterEach(() => {
    clearPendingAuthAction()
    vi.useRealTimers()
  })

  it('stores and peeks a save intent', () => {
    const stored = setPendingAuthAction({
      kind: 'save',
      source: 'ready_route',
      returnPath: '/ruta',
    })
    expect(stored?.kind).toBe('save')
    expect(peekPendingAuthAction()?.returnPath).toBe('/ruta')
    expect(postLoginPath()).toBe('/ruta')
    expect(pendingAuthTrackProps()).toEqual({ from: 'save', via: 'ready_route' })
  })

  it('rejects open-redirect paths', () => {
    expect(isAllowedAuthReturnPath('/login')).toBe(false)
    expect(setPendingAuthAction({ kind: 'save', source: 'trazar', returnPath: 'https://evil.test' })).toBeNull()
    expect(setPendingAuthAction({ kind: 'save', source: 'trazar', returnPath: '/my-routes' })).toBeNull()
    expect(postLoginPath()).toBe('/my-routes')
  })

  it('consume is source-scoped and clears once', () => {
    setPendingAuthAction({ kind: 'share', source: 'trazar', returnPath: '/route-planner' })
    expect(consumePendingAuthAction('ready_route')).toBeNull()
    expect(peekPendingAuthAction()?.source).toBe('trazar')
    expect(consumePendingAuthAction('trazar')?.kind).toBe('share')
    expect(peekPendingAuthAction()).toBeNull()
  })

  it('expires after 45 minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T08:00:00Z'))
    setPendingAuthAction({ kind: 'save', source: 'ready_route', returnPath: '/ruta' })
    vi.setSystemTime(new Date('2026-08-14T08:50:00Z'))
    expect(peekPendingAuthAction()).toBeNull()
  })

  it('builds a same-origin Google bridge return', () => {
    expect(googleBridgeReturnUrl('https://pedalmap.es')).toBe('https://pedalmap.es/login')
    setPendingAuthAction({ kind: 'save', source: 'trazar', returnPath: '/route-planner' })
    expect(googleBridgeReturnUrl('https://pedalmap.es')).toBe('https://pedalmap.es/route-planner')
  })
})
