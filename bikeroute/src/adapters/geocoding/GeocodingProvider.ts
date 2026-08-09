import type { LatLng, PlaceSuggestion } from '@/domain/types'

export interface GeocodingProvider {
  readonly name: string
  isConfigured(): boolean
  search(query: string, options?: { proximity?: LatLng; limit?: number }): Promise<PlaceSuggestion[]>
  reverse?(position: LatLng): Promise<PlaceSuggestion | null>
}
