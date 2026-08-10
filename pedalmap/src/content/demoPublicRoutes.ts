/**
 * Curated demo public routes for Explorar when Firestore is empty (soft-launch).
 * Not persisted — shown only as placeholders until the community publishes real rides.
 */
export interface DemoPublicRoute {
  id: string
  title: string
  bikeType: 'road' | 'mtb' | 'gravel' | 'urban' | 'ebike'
  distanceMeters: number
  elevationGainMeters: number
  blurb: string
  area: string
}

export const DEMO_PUBLIC_ROUTES: DemoPublicRoute[] = [
  {
    id: 'demo-casa-de-campo',
    title: 'Casa de Campo — vuelta urbana',
    bikeType: 'urban',
    distanceMeters: 22000,
    elevationGainMeters: 180,
    blurb: 'Carril bici y parque. Ideal para rodaje suave.',
    area: 'Madrid',
  },
  {
    id: 'demo-guadarrama-gravel',
    title: 'Pistas del Guadarrama (gravel)',
    bikeType: 'gravel',
    distanceMeters: 48000,
    elevationGainMeters: 780,
    blurb: 'Grava compacta y pistas forestales con enlace de asfalto.',
    area: 'Sierra de Guadarrama',
  },
  {
    id: 'demo-navacerrada-road',
    title: 'Puerto de Navacerrada (carretera)',
    bikeType: 'road',
    distanceMeters: 62000,
    elevationGainMeters: 1200,
    blurb: 'Clásica de asfalto. Perfil carretera exigente.',
    area: 'Navacerrada',
  },
  {
    id: 'demo-dehesas-mtb',
    title: 'Dehesas — senderos MTB',
    bikeType: 'mtb',
    distanceMeters: 28000,
    elevationGainMeters: 650,
    blurb: 'Senderos y tierra; poco asfalto.',
    area: 'Cercedilla',
  },
]
