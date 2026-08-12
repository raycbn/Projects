import { SITE_ORIGIN, SITE_NAME, DEFAULT_OG_IMAGE } from '@/lib/site'
import { BRAND_EMAILS } from '@/lib/brandEmails'
import type { FaqItem } from '@/content/faqs'

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    legalName: 'PedalMap',
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/logo.png`,
    image: `${SITE_ORIGIN}/og-square.jpg`,
    email: BRAND_EMAILS.hello,
    description:
      'PedalMap es un planificador de rutas de bicicleta para España (no confundir con Petal Maps de Huawei): mapa, desnivel, viento, superficie según el tipo de bici y exportación GPX.',
    foundingDate: '2026',
    sameAs: [] as string[],
    knowsAbout: [
      'planificación de rutas ciclistas',
      'exportación GPX',
      'ciclismo en España',
      'gravel',
      'MTB',
      'Garmin',
      'Wahoo',
    ],
    areaServed: {
      '@type': 'Country',
      name: 'España',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: BRAND_EMAILS.hello,
      contactType: 'customer support',
      availableLanguage: ['Spanish', 'es'],
    },
  }
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    alternateName: ['Pedal Map', 'pedalmap.es'],
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: 'Bike route planner',
    operatingSystem: 'Web',
    url: SITE_ORIGIN,
    image: DEFAULT_OG_IMAGE,
    description:
      'Planificador de rutas de bicicleta para España: mapa, desnivel, viento, superficie según tu bici (carretera, urbana, gravel, MTB, e-bike) y exportación GPX para Garmin, Wahoo, OsmAnd y Organic Maps.',
    featureList: [
      'Crear ruta bicicleta origen-destino',
      'Ruta circular por kilómetros y desnivel (Objetivo)',
      'Perfiles carretera, urbana, gravel, MTB y e-bike',
      'Desnivel y perfil de elevación',
      'Viento relativo al sentido de la ruta',
      'Composición de superficie',
      'Exportación GPX',
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      url: `${SITE_ORIGIN}/premium`,
      description: 'Plan Free para empezar; Premium opcional con trial anual de 7 días',
    },
    countriesSupported: 'ES',
    inLanguage: 'es-ES',
    creator: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_ORIGIN,
    },
  }
}

export function faqPageJsonLd(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}

export function webPageJsonLd(opts: {
  path: string
  name: string
  description: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: opts.name,
    description: opts.description,
    url: `${SITE_ORIGIN}${opts.path}`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_ORIGIN,
    },
    inLanguage: 'es-ES',
  }
}
