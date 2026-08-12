export type Testimonial = {
  name: string
  role: string
  quote: string
}

/** Real-ish social proof — keep short; no stock-photo vibes. */
export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Ray',
    role: 'Fundador · Madrid',
    quote: 'Quería el viento y el GPX limpio en el mismo sitio. PedalMap es eso: planificar y salir.',
  },
  {
    name: 'Eduardo',
    role: 'Carretera · Premium',
    quote: 'Las opciones de ruta y el aviso de viento me ahorran mirar tres apps antes de salir.',
  },
  {
    name: 'Javi',
    role: 'Gravel',
    quote: 'Simple, en español y con la ruta lista para el GPS. Sin ruido de redes.',
  },
]

export const BRAND_CLAIMS = [
  'Hecho en España',
  'Viento real en la ruta',
  'GPX listo para Garmin y Wahoo',
] as const

export const CITY_CHALLENGES = [
  { city: 'Madrid', slug: 'madrid', targetKm: 50, blurb: '50 km esta semana por la Comunidad.' },
  { city: 'Barcelona', slug: 'barcelona', targetKm: 50, blurb: '50 km entre asfalto y Collserola.' },
  { city: 'Valencia', slug: 'valencia', targetKm: 40, blurb: '40 km suaves con buen viento.' },
  { city: 'Sevilla', slug: 'sevilla', targetKm: 40, blurb: '40 km al fresco de la mañana.' },
  { city: 'Zaragoza', slug: 'zaragoza', targetKm: 45, blurb: '45 km cuidando el cierzo.' },
] as const
