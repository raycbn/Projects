import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/domain/types'

export interface GeolocationSample {
  position: LatLng
  elevationMeters?: number
  accuracyMeters?: number
  recordedAt: string
}

export function useGeolocation(enabled: boolean) {
  const [sample, setSample] = useState<GeolocationSample | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'geolocation' in navigator)
  const watchId = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current !== null && supported) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [supported])

  useEffect(() => {
    if (!enabled || !supported) {
      stop()
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        setSample({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          elevationMeters:
            typeof pos.coords.altitude === 'number' && Number.isFinite(pos.coords.altitude)
              ? pos.coords.altitude
              : undefined,
          accuracyMeters: pos.coords.accuracy,
          recordedAt: new Date(pos.timestamp).toISOString(),
        })
      },
      (err) => {
        setError(err.message || 'No se pudo obtener la ubicación')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      },
    )

    return () => stop()
  }, [enabled, supported, stop])

  return { sample, error, supported, stop }
}
