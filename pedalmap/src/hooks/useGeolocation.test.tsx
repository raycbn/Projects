import { renderHook, act } from '@testing-library/react'
import { useGeolocation } from '@/hooks/useGeolocation'

const origNavigator = window.navigator

function mockGeo(impl: Record<string, unknown> | undefined): void {
  const nav: Record<string, unknown> = { ...origNavigator }
  if (impl) {
    nav.geolocation = impl
  } else {
    delete nav.geolocation
  }
  vi.stubGlobal('navigator', nav)
}

describe('useGeolocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports position when the watch is granted', () => {
    mockGeo({
      watchPosition: (success: (p: unknown) => void) => {
        success({
          coords: {
            latitude: 40.42,
            longitude: -3.7,
            altitude: 620,
            accuracy: 10,
          },
          timestamp: Date.now(),
        })
        return 1
      },
      clearWatch: () => {},
    })

    const { result } = renderHook(() => useGeolocation(true))
    expect(result.current.supported).toBe(true)
    expect(result.current.sample).toMatchObject({
      position: { lat: 40.42, lng: -3.7 },
      elevationMeters: 620,
    })
    expect(result.current.error).toBeNull()

    act(() => {
      result.current.stop()
    })
  })

  it('sets an error when permission is denied', () => {
    mockGeo({
      watchPosition: (_ok: (p: unknown) => void, err: (e: unknown) => void) => {
        err({ code: 1, message: 'Permission denied' })
        return 1
      },
      clearWatch: () => {},
    })

    const { result, unmount } = renderHook(() => useGeolocation(true))
    expect(result.current.error).toMatch(/ubicación|denied/i)
    expect(result.current.sample).toBeNull()
    act(() => unmount())
  })

  it('reports unsupported when navigator.geolocation is absent (no GPS)', () => {
    mockGeo(undefined)
    const { result } = renderHook(() => useGeolocation(true))
    expect(result.current.supported).toBe(false)
  })
})
