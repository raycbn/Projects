import { describe, expect, it } from 'vitest'
import { shortPlaceNameForTitle } from '@/lib/shortPlaceName'

describe('shortPlaceNameForTitle', () => {
  it('keeps Estoy aquí', () => {
    expect(shortPlaceNameForTitle('Estoy aquí')).toBe('Estoy aquí')
    expect(shortPlaceNameForTitle('Estoy aqui')).toBe('Estoy aquí')
  })

  it('shortens full Nominatim POI + address', () => {
    expect(
      shortPlaceNameForTitle(
        'Ayuntamiento de Talamanca de Jarama, 19, Calle Fuente del Arca, Talamanca de Jarama, Comunidad de Madrid, 28160, España',
      ),
    ).toBe('Ayuntamiento de Talamanca de Jarama')
  })

  it('shortens city with province and country', () => {
    expect(
      shortPlaceNameForTitle('Vicálvaro, Madrid, Comunidad de Madrid, España'),
    ).toBe('Vicálvaro')
  })

  it('drops street-first address down to locality', () => {
    expect(
      shortPlaceNameForTitle(
        'Calle Mayor, 12, Alcalá de Henares, Comunidad de Madrid, 28801, España',
      ),
    ).toBe('Alcalá de Henares')
  })

  it('handles empty', () => {
    expect(shortPlaceNameForTitle('')).toBe('Lugar')
    expect(shortPlaceNameForTitle(null)).toBe('Lugar')
  })
})
