import type { GeocodingProvider } from '@/adapters/geocoding/GeocodingProvider'
import type { LatLng, PlaceSuggestion } from '@/domain/types'

/**
 * Tries providers in order. Used so Nominatim remains primary while Photon
 * covers datacenter / rate-limit denials without faking results.
 */
export class FallbackGeocodingProvider implements GeocodingProvider {
  readonly name = 'fallback-geocoder'

  constructor(private readonly providers: GeocodingProvider[]) {}

  isConfigured(): boolean {
    return this.providers.some((p) => p.isConfigured())
  }

  async search(
    query: string,
    options?: { proximity?: LatLng; limit?: number },
  ): Promise<PlaceSuggestion[]> {
    let lastError: unknown
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue
      try {
        const results = await provider.search(query, options)
        if (results.length) return results
      } catch (error) {
        lastError = error
        console.warn(`[geocode] ${provider.name} failed, trying next`, error)
      }
    }
    if (lastError) throw lastError
    return []
  }
}
