/** Deterministic 90-day SEO social calendar (Instagram / Buffer / cron). */
export const SOCIAL_CAMPAIGN_DEFAULT_START = '2026-08-12'
export const SOCIAL_CAMPAIGN_DAYS = 90
export const SITE_ORIGIN = 'https://pedalmap.es'

const IMAGES = [
  'pedalmap-post-crear-ruta.jpg',
  'pedalmap-post-gpx-garmin.jpg',
  'pedalmap-post-viento.jpg',
  'pedalmap-post-madrid.jpg',
  'pedalmap-post-premium.jpg',
  'pedalmap-reel-cover-gpx.jpg',
  'pedalmap-reel-cover-objetivo.jpg',
  'pedalmap-reel-cover-primera-ruta.jpg',
] as const

const CITIES: Array<[string, string]> = [
  ['Madrid', '/rutas-bicicleta-madrid'],
  ['Barcelona', '/rutas-bicicleta-barcelona'],
  ['Valencia', '/rutas-bicicleta-valencia'],
  ['Sevilla', '/rutas-bicicleta-sevilla'],
  ['Bilbao', '/rutas-bicicleta-bilbao'],
  ['Zaragoza', '/rutas-bicicleta-zaragoza'],
  ['Málaga', '/rutas-bicicleta-malaga'],
  ['Granada', '/rutas-bicicleta-granada'],
  ['Alicante', '/rutas-bicicleta-alicante'],
  ['Murcia', '/rutas-bicicleta-murcia'],
  ['Santander', '/rutas-bicicleta-santander'],
  ['Córdoba', '/rutas-bicicleta-cordoba'],
  ['Valladolid', '/rutas-bicicleta-valladolid'],
  ['Pamplona', '/rutas-bicicleta-pamplona'],
  ['Palma', '/rutas-bicicleta-palma'],
]

export type SocialPost = {
  day: number
  date: string
  theme: string
  seoFocus: string
  path: string
  imageUrl: string
  imageFile: string
  caption: string
}

function citySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function addUtcDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function templateFor(dayIndex: number): Omit<SocialPost, 'day' | 'date' | 'imageUrl' | 'imageFile'> {
  const i = dayIndex % 18
  if (i === 0) {
    return {
      theme: 'crear-ruta',
      seoFocus: 'crear ruta bicicleta',
      path: '/crear-ruta-bicicleta',
      caption: `Crea tu próxima ruta en bici en minutos.\nMapa · desnivel · superficie · viento.\n\nEmpieza Free → ${SITE_ORIGIN}/crear-ruta-bicicleta\n#ciclismo #bici #rutas #pedalmap #españa`,
    }
  }
  if (i === 1) {
    return {
      theme: 'gpx-garmin',
      seoFocus: 'crear ruta GPX Garmin',
      path: '/blog/exportar-gpx-garmin',
      caption: `GPX de PedalMap → Garmin Connect → Edge.\nPlanifica con desnivel real antes de salir.\n\nGuía: ${SITE_ORIGIN}/blog/exportar-gpx-garmin\n#garmin #gpx #ciclismo #pedalmap`,
    }
  }
  if (i === 2) {
    return {
      theme: 'wahoo',
      seoFocus: 'pasar ruta Wahoo',
      path: '/blog/pasar-ruta-wahoo',
      caption: `¿Wahoo ELEMNT?\nMisma ruta PedalMap → GPX → app.\nSuelo + viento + metros antes del entreno.\n\n${SITE_ORIGIN}/blog/pasar-ruta-wahoo\n#wahoo #gpx #ciclismo #pedalmap`,
    }
  }
  if (i === 3) {
    return {
      theme: 'circular',
      seoFocus: 'ruta circular bicicleta',
      path: '/ruta-circular-bicicleta',
      caption: `¿Quieres ~60 km y 800 m+ sin destino fijo?\nModo Objetivo = ruta circular.\n1 Free/mes · ilimitado en Premium.\n\n${SITE_ORIGIN}/ruta-circular-bicicleta\n#entreno #ciclismo #pedalmap`,
    }
  }
  if (i === 4) {
    return {
      theme: 'viento',
      seoFocus: 'viento en la ruta bici',
      path: '/blog/viento-en-la-ruta',
      caption: `El viento no se ve en Strava hasta que duele.\nMíralo relativo a tu ruta antes de salir.\n\n${SITE_ORIGIN}/blog/viento-en-la-ruta\n#ciclismo #entreno #pedalmap`,
    }
  }
  if (i === 5) {
    return {
      theme: 'desnivel',
      seoFocus: 'calcular desnivel ruta bici',
      path: '/blog/calcular-desnivel-ruta-bici',
      caption: `Los km mienten. El desnivel no.\nRevisa el perfil antes de comprometerte.\n\n${SITE_ORIGIN}/blog/calcular-desnivel-ruta-bici\n#ciclismo #desnivel #pedalmap`,
    }
  }
  if (i === 6) {
    const [name, path] = CITIES[dayIndex % CITIES.length]
    return {
      theme: `ciudad-${citySlug(name)}`,
      seoFocus: `rutas bicicleta ${name}`,
      path,
      caption: `Rutas de bicicleta en ${name}: traza, mira metros y lleva GPX.\n\nGuía: ${SITE_ORIGIN}${path}\n#${citySlug(name)} #ciclismo #pedalmap`,
    }
  }
  if (i === 7) {
    return {
      theme: 'gravel',
      seoFocus: 'planificador rutas gravel',
      path: '/planificador-rutas-gravel',
      caption: `Gravel ≠ carretera ≠ MTB.\nMismo A→B, distinta bici = distinta ruta.\n\n${SITE_ORIGIN}/planificador-rutas-gravel\n#gravel #ciclismo #pedalmap`,
    }
  }
  if (i === 8) {
    return {
      theme: 'mtb',
      seoFocus: 'planificador rutas MTB',
      path: '/planificador-rutas-mtb',
      caption: `MTB con desnivel visible y track GPX.\nPlanifica la sierra antes de improvisar.\n\n${SITE_ORIGIN}/planificador-rutas-mtb\n#mtb #ciclismo #pedalmap`,
    }
  }
  if (i === 9) {
    return {
      theme: 'komoot',
      seoFocus: 'alternativa Komoot España',
      path: '/alternativa-komoot',
      caption: `¿Buscas alternativa a Komoot en España para planificar (no scrollear tracks)?\nPedalMap: desnivel · viento · GPX · Free.\n\n${SITE_ORIGIN}/alternativa-komoot\n#komoot #ciclismo #pedalmap`,
    }
  }
  if (i === 10) {
    return {
      theme: 'perfil-bici',
      seoFocus: 'perfil bici carretera gravel MTB',
      path: '/blog/elegir-perfil-bici',
      caption: `Carretera, gravel o MTB: el perfil cambia el track.\nElige bien antes de calcular.\n\n${SITE_ORIGIN}/blog/elegir-perfil-bici\n#ciclismo #pedalmap`,
    }
  }
  if (i === 11) {
    return {
      theme: 'osmand',
      seoFocus: 'GPX OsmAnd Organic Maps',
      path: '/blog/gpx-osmand-organic-maps',
      caption: `Sin Edge: GPX + OsmAnd / Organic Maps.\nMisma ruta PedalMap en el móvil.\n\n${SITE_ORIGIN}/blog/gpx-osmand-organic-maps\n#osmand #gpx #ciclismo #pedalmap`,
    }
  }
  if (i === 12) {
    return {
      theme: 'primera-ruta',
      seoFocus: 'crear ruta bicicleta online',
      path: '/blog/primera-ruta-pedalmap',
      caption: `Primera ruta en PedalMap en 5 minutos.\nOrigen + destino + bici + calcular.\n\n${SITE_ORIGIN}/blog/primera-ruta-pedalmap\n#tutorial #ciclismo #pedalmap`,
    }
  }
  if (i === 13) {
    return {
      theme: 'grupeta',
      seoFocus: 'compartir ruta grupeta GPX',
      path: '/blog/compartir-ruta-grupeta',
      caption: `Grupeta sin “¿por dónde vamos?”\nRuta + desnivel + un GPX al chat.\n\n${SITE_ORIGIN}/blog/compartir-ruta-grupeta\n#grupeta #ciclismo #pedalmap`,
    }
  }
  if (i === 14) {
    return {
      theme: 'premium',
      seoFocus: 'PedalMap Free vs Premium',
      path: '/blog/free-vs-premium',
      caption: `Free para probar. Premium cuando entrenas en serio.\nTrial 7 días en el plan anual.\n\n${SITE_ORIGIN}/premium\n#pedalmap #ciclismo`,
    }
  }
  if (i === 15) {
    return {
      theme: 'evitar-trafico',
      seoFocus: 'evitar carreteras ruta bici',
      path: '/blog/evitar-carreteras-ruta-bici',
      caption: `Menos nacional, más carril.\nAjusta preferencias y recalcula antes de salir.\n\n${SITE_ORIGIN}/blog/evitar-carreteras-ruta-bici\n#seguridad #ciclismo #pedalmap`,
    }
  }
  if (i === 16) {
    return {
      theme: 'planificador-es',
      seoFocus: 'mejor planificador rutas bici España',
      path: '/mejor-planificador-rutas-bici',
      caption: `Checklist de un buen planificador de rutas bici en España:\nperfil · desnivel · viento · GPX.\n\n${SITE_ORIGIN}/mejor-planificador-rutas-bici\n#ciclismo #españa #pedalmap`,
    }
  }
  return {
    theme: 'engagement',
    seoFocus: 'planificador rutas bici',
    path: '/route-planner',
    caption: `¿Garmin, Wahoo o móvil?\nComenta 1️⃣ 2️⃣ 3️⃣\nGuías GPX en el perfil 👆 · planificador: ${SITE_ORIGIN}/route-planner\n#ciclismo #pedalmap`,
  }
}

export function buildSocialCalendar(startDate = SOCIAL_CAMPAIGN_DEFAULT_START): SocialPost[] {
  const posts: SocialPost[] = []
  for (let dayIndex = 0; dayIndex < SOCIAL_CAMPAIGN_DAYS; dayIndex += 1) {
    const base = templateFor(dayIndex)
    const imageFile = IMAGES[dayIndex % IMAGES.length]
    posts.push({
      day: dayIndex + 1,
      date: addUtcDays(startDate, dayIndex),
      ...base,
      imageFile,
      imageUrl: `${SITE_ORIGIN}/social/${imageFile}`,
    })
  }
  return posts
}

/** Days since startDate (UTC date), 0-based. Negative if before start. */
export function campaignDayIndex(now: Date, startDate: string): number {
  const [y, m, d] = startDate.split('-').map(Number)
  const start = Date.UTC(y, m - 1, d)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((today - start) / 86_400_000)
}

export function postForCampaignDay(
  dayIndex: number,
  startDate = SOCIAL_CAMPAIGN_DEFAULT_START,
): SocialPost | null {
  if (dayIndex < 0 || dayIndex >= SOCIAL_CAMPAIGN_DAYS) return null
  return buildSocialCalendar(startDate)[dayIndex] ?? null
}
