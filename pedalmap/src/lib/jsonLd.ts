import { SITE_ORIGIN, SITE_NAME, DEFAULT_OG_IMAGE } from '@/lib/site'
import { BRAND_EMAILS } from '@/lib/brandEmails'
import type { FaqItem } from '@/content/faqs'

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/favicon.svg`,
    email: BRAND_EMAILS.hello,
    sameAs: [],
    areaServed: {
      '@type': 'Country',
      name: 'España',
    },
  }
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    url: SITE_ORIGIN,
    image: DEFAULT_OG_IMAGE,
    description:
      'Planificador de rutas de bicicleta para España: mapa, desnivel, viento, superficie según tu bici y exportación GPX.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Plan Free para empezar; Premium opcional',
    },
    inLanguage: 'es-ES',
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
