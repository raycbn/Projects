import type { GeocodingProvider } from '@/adapters/geocoding/GeocodingProvider'
import type { LatLng, PlaceSuggestion } from '@/domain/types'
import { GeocodingError } from '@/domain/types'

/**
 * Nominatim (OSM) geocoder for low-volume MVP usage.
 * Policy: https://operations.osmfoundation.org/policies/nominatim/
 * - Provide a valid User-Agent / referer
 * - Max ~1 req/s
 * - No heavy production traffic without your own instance
 *
 * For production scale, switch to Photon self-host or ORS geocode.
 */
export class NominatimProvider implements GeocodingProvider {
  readonly name = 'nominatim'
  private readonly baseUrl: string
  private readonly email: string | undefined

  constructor(
    baseUrl = 'https://nominatim.openstreetmap.org',
    email = import.meta.env.VITE_GEOCODER_CONTACT_EMAIL as string | undefined,
  ) {
    this.baseUrl = baseUrl
    this.email = email
  }

  isConfigured(): boolean {
    // Public Nominatim works without key but has strict fair-use policy.
    return true
  }

  async search(
    query: string,
    options?: { proximity?: LatLng; limit?: number },
  ): Promise<PlaceSuggestion[]> {
    const q = query.trim()
    if (q.length < 2) return []

    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '0',
      limit: String(options?.limit ?? 5),
      countrycodes: 'es',
    })

    if (this.email) params.set('email', this.email)

    try {
      const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        // Public Nominatim often returns 403 to datacenter IPs / missing UA policy.
        throw new GeocodingError('Geocoding provider error', 'provider_error', response.status)
      }

      const raw = await response.text()
      if (raw.startsWith('Access den')) {
        throw new GeocodingError('Geocoding provider error', 'provider_error', 'access_denied')
      }

      const data = JSON.parse(raw) as Array<{
        place_id: number
        display_name: string
        lat: string
        lon: string
        boundingbox?: [string, string, string, string]
      }>

      return data.map((item) => ({
        id: String(item.place_id),
        label: item.display_name,
        position: { lat: Number(item.lat), lng: Number(item.lon) },
        bbox: item.boundingbox
          ? [
              Number(item.boundingbox[2]),
              Number(item.boundingbox[0]),
              Number(item.boundingbox[3]),
              Number(item.boundingbox[1]),
            ]
          : undefined,
      }))
    } catch (error) {
      if (error instanceof GeocodingError) throw error
      if (error instanceof SyntaxError) {
        throw new GeocodingError('Geocoding provider error', 'provider_error', error)
      }
      throw new GeocodingError('Network error', 'network', error)
    }
  }

  async reverse(position: LatLng): Promise<PlaceSuggestion | null> {
    const params = new URLSearchParams({
      lat: String(position.lat),
      lon: String(position.lng),
      format: 'jsonv2',
    })
    if (this.email) params.set('email', this.email)

    const response = await fetch(`${this.baseUrl}/reverse?${params.toString()}`)
    if (!response.ok) return null
    const data = (await response.json()) as { place_id?: number; display_name?: string }
    if (!data.display_name) return null
    return {
      id: String(data.place_id ?? `${position.lat},${position.lng}`),
      label: data.display_name,
      position,
    }
  }
}
