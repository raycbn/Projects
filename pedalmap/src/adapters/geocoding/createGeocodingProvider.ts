import { FallbackGeocodingProvider } from '@/adapters/geocoding/FallbackGeocodingProvider'
import type { GeocodingProvider } from '@/adapters/geocoding/GeocodingProvider'
import { NominatimProvider } from '@/adapters/geocoding/NominatimProvider'
import { PhotonProvider } from '@/adapters/geocoding/PhotonProvider'

export function createGeocodingProvider(): GeocodingProvider {
  return new FallbackGeocodingProvider([new NominatimProvider(), new PhotonProvider()])
}
