import { NominatimProvider } from '@/adapters/geocoding/NominatimProvider'
import type { GeocodingProvider } from '@/adapters/geocoding/GeocodingProvider'

export function createGeocodingProvider(): GeocodingProvider {
  return new NominatimProvider()
}
