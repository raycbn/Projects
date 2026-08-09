/**
 * Map tile / style provider abstraction.
 * MapView reads VITE_MAP_STYLE_URL so providers can be swapped without UI rewrites.
 */

export interface MapTileProviderInfo {
  id: string
  styleUrl: string
  requiresKey: boolean
  notes: string
}

export function getMapStyleUrl(): string {
  return (
    import.meta.env.VITE_MAP_STYLE_URL ||
    'https://tiles.openfreemap.org/styles/liberty'
  )
}

export const DEFAULT_TILE_PROVIDER: MapTileProviderInfo = {
  id: 'openfreemap',
  styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  requiresKey: false,
  notes:
    'OpenFreeMap — free vector tiles suitable for MVP. Review usage terms for production scale; migrate to MapTiler/Stadia/self-host when traffic grows.',
}
