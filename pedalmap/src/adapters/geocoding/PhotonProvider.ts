import type { GeocodingProvider } from '@/adapters/geocoding/GeocodingProvider'
import type { LatLng, PlaceSuggestion } from '@/domain/types'
import { GeocodingError } from '@/domain/types'

/**
 * Photon (Komoot) — OSM-based geocoder, useful fallback when public Nominatim
 * rate-limits / blocks datacenter IPs. Free public instance is not a production SLA.
 * @see https://github.com/komoot/photon
 */
export class PhotonProvider implements GeocodingProvider {
  readonly name = 'photon'

  constructor(private readonly baseUrl = 'https://photon.komoot.io') {}

  isConfigured(): boolean {
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
      limit: String(options?.limit ?? 5),
      lang: 'es',
    })
    if (options?.proximity) {
      params.set('lat', String(options.proximity.lat))
      params.set('lon', String(options.proximity.lng))
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        throw new GeocodingError('Geocoding provider error', 'provider_error', response.status)
      }
      const data = (await response.json()) as {
        features?: Array<{
          properties?: {
            osm_id?: number
            name?: string
            city?: string
            state?: string
            country?: string
            extent?: number[]
          }
          geometry?: { coordinates?: [number, number] }
        }>
      }

      const results: PlaceSuggestion[] = []
      for (const [index, f] of (data.features ?? []).entries()) {
        const coords = f.geometry?.coordinates
        if (!coords) continue
        const [lng, lat] = coords
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
        const label = [f.properties?.name, f.properties?.city, f.properties?.state, f.properties?.country]
          .filter(Boolean)
          .join(', ')
        const suggestion: PlaceSuggestion = {
          id: String(f.properties?.osm_id ?? `photon-${index}`),
          label: label || `${lat}, ${lng}`,
          position: { lat, lng },
        }
        if (f.properties?.extent && f.properties.extent.length >= 4) {
          suggestion.bbox = [
            f.properties.extent[0],
            f.properties.extent[1],
            f.properties.extent[2],
            f.properties.extent[3],
          ]
        }
        results.push(suggestion)
      }
      return results
    } catch (error) {
      if (error instanceof GeocodingError) throw error
      throw new GeocodingError('Network error', 'network', error)
    }
  }
}
