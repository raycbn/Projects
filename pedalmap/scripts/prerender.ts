/**
 * Post-build prerender: writes static HTML shells with real title/meta/body/JSON-LD
 * so crawlers see content without executing the SPA.
 *
 * Run after `vite build` via: npx vite-node scripts/prerender.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seoPages } from '../src/content/seoPages'
import { landingFaqs } from '../src/content/faqs'
import {
  faqPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webPageJsonLd,
} from '../src/lib/jsonLd'
import { DEFAULT_OG_IMAGE, SITE_ORIGIN } from '../src/lib/site'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = join(root, 'dist')
const templatePath = join(dist, 'index.html')

type PageSpec = {
  path: string
  title: string
  description: string
  heading: string
  paragraphs: string[]
  jsonLd: object | object[]
  related?: Array<{ to: string; label: string }>
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function upsertMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`, 'i')
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function upsertCanonical(html: string, href: string): string {
  const re = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i
  const tag = `<link rel="canonical" href="${escapeHtml(href)}" />`
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function upsertTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
}

function injectJsonLd(html: string, data: object | object[]): string {
  const payload = Array.isArray(data) ? data : [data]
  const scripts = payload
    .map(
      (block) =>
        `<script type="application/ld+json">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n    ')
  // Drop any previous prerender ld+json we might re-run against.
  const cleaned = html.replace(
    /\n?\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
    '',
  )
  return cleaned.replace('</head>', `    ${scripts}\n  </head>`)
}

function prerenderBody(page: PageSpec): string {
  const related =
    page.related && page.related.length
      ? `<nav aria-label="Guías relacionadas"><h2>Sigue explorando</h2><ul>${page.related
          .map((r) => `<li><a href="${escapeHtml(r.to)}">${escapeHtml(r.label)}</a></li>`)
          .join('')}</ul></nav>`
      : ''
  const paras = page.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
  return `<main id="prerender-root" data-prerender="true">
  <p><strong>PedalMap</strong></p>
  <h1>${escapeHtml(page.heading)}</h1>
  ${paras}
  <p><a href="/route-planner">Abrir planificador</a> · <a href="/">Inicio</a></p>
  ${related}
</main>`
}

function writePage(template: string, page: PageSpec) {
  const url = page.path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${page.path}`
  let html = template
  html = upsertTitle(html, page.title)
  html = upsertMeta(html, 'name', 'description', page.description)
  html = upsertMeta(html, 'property', 'og:title', page.title)
  html = upsertMeta(html, 'property', 'og:description', page.description)
  html = upsertMeta(html, 'property', 'og:url', url)
  html = upsertMeta(html, 'property', 'og:image', DEFAULT_OG_IMAGE)
  html = upsertMeta(html, 'name', 'twitter:title', page.title)
  html = upsertMeta(html, 'name', 'twitter:description', page.description)
  html = upsertMeta(html, 'name', 'twitter:image', DEFAULT_OG_IMAGE)
  html = upsertCanonical(html, url)
  html = injectJsonLd(html, page.jsonLd)

  const body = prerenderBody(page)
  if (html.includes('<div id="root"></div>')) {
    html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
  } else if (html.includes('<div id="root">')) {
    html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*<script/, `<div id="root">${body}</div>\n    <script`)
  }

  const outPath =
    page.path === '/'
      ? join(dist, 'index.html')
      : join(dist, page.path.replace(/^\//, ''), 'index.html')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, html)
  console.log('prerender', page.path, '→', outPath.replace(root + '/', ''))
}

const pages: PageSpec[] = [
  {
    path: '/',
    title: 'PedalMap — Crea tu próxima ruta en bici',
    description:
      'Planifica rutas ciclistas reales en España con mapa, desnivel, viento y superficie según tu bici. Free para empezar, Premium cuando lo necesites.',
    heading: 'Crea tu próxima ruta en bici',
    paragraphs: [
      'PedalMap es el planificador de rutas de bicicleta para España: mapa, desnivel, viento y superficie según carretera, gravel, MTB, urbana o e-bike.',
      'Empieza gratis, exporta GPX y pasa a Premium cuando necesites rutas y Objetivo sin límites.',
      ...landingFaqs.map((f) => `${f.q} ${f.a}`),
    ],
    jsonLd: [organizationJsonLd(), softwareApplicationJsonLd(), faqPageJsonLd(landingFaqs)],
    related: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta bicicleta' },
      { to: '/rutas-bicicleta-madrid', label: 'Rutas Madrid' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  ...seoPages.map((p) => ({
    path: p.path,
    title: p.title,
    description: p.description,
    heading: p.heading,
    paragraphs: p.body,
    related: p.related,
    jsonLd: webPageJsonLd({
      path: p.path,
      name: p.heading,
      description: p.description,
    }),
  })),
  {
    path: '/premium',
    title: 'PedalMap Premium',
    description:
      'Rutas ilimitadas, GPX a tu GPS y Objetivo avanzado. Prueba 7 días con el plan anual · 39,99 €/año o 4,99 €/mes.',
    heading: 'PedalMap Premium',
    paragraphs: [
      'Premium quita los límites de creaciones, GPX y Objetivo, y añade avisos de viento en todas tus rutas guardadas.',
      'El plan anual incluye 7 días de prueba. Cancela cuando quieras desde el portal de cliente de Stripe.',
    ],
    jsonLd: webPageJsonLd({
      path: '/premium',
      name: 'PedalMap Premium',
      description: 'Suscripción Premium de PedalMap',
    }),
  },
  {
    path: '/route-planner',
    title: 'Planificador de rutas en bicicleta | PedalMap',
    description:
      'Crea rutas ciclistas con mapa, desnivel, tiempo estimado y perfil de elevación. Ideal para carretera, MTB y gravel.',
    heading: 'Planificador de rutas en bicicleta',
    paragraphs: [
      'Abre el mapa, elige salida y destino, selecciona tu tipo de bici y calcula una ruta realista con desnivel y superficie.',
    ],
    jsonLd: webPageJsonLd({
      path: '/route-planner',
      name: 'Planificador de rutas en bicicleta',
      description: 'Herramienta PedalMap para crear rutas ciclistas',
    }),
  },
  {
    path: '/explorar',
    title: 'Explorar comunidad | PedalMap',
    description: 'Rutas públicas, ciclistas, segmentos, retos y guías locales en PedalMap.',
    heading: 'Explorar',
    paragraphs: [
      'Descubre rutas de la comunidad y guías para crear salidas en Madrid, Barcelona, Valencia y Sevilla.',
    ],
    jsonLd: webPageJsonLd({
      path: '/explorar',
      name: 'Explorar comunidad',
      description: 'Comunidad y guías PedalMap',
    }),
    related: seoPages.slice(0, 6).map((p) => ({ to: p.path, label: p.heading })),
  },
  {
    path: '/privacidad',
    title: 'Privacidad | PedalMap',
    description: 'Política de privacidad y minimización de datos de PedalMap (RGPD).',
    heading: 'Privacidad',
    paragraphs: [
      'PedalMap minimiza datos personales. Consulta la política completa en esta página tras cargar la app.',
    ],
    jsonLd: webPageJsonLd({
      path: '/privacidad',
      name: 'Privacidad',
      description: 'Política de privacidad PedalMap',
    }),
  },
  {
    path: '/cookies',
    title: 'Cookies | PedalMap',
    description: 'Información sobre cookies y almacenamiento local en PedalMap.',
    heading: 'Cookies',
    paragraphs: [
      'Usamos cookies técnicas necesarias y, solo si aceptas, analítica opcional para mejorar el producto.',
    ],
    jsonLd: webPageJsonLd({
      path: '/cookies',
      name: 'Cookies',
      description: 'Cookies PedalMap',
    }),
  },
  {
    path: '/terminos',
    title: 'Términos | PedalMap',
    description: 'Términos de uso de PedalMap.',
    heading: 'Términos de uso',
    paragraphs: ['Condiciones de uso del servicio PedalMap (planificador de rutas ciclistas).'],
    jsonLd: webPageJsonLd({
      path: '/terminos',
      name: 'Términos',
      description: 'Términos de uso PedalMap',
    }),
  },
]

const template = readFileSync(templatePath, 'utf8')
for (const page of pages) writePage(template, page)
console.log(`Prerendered ${pages.length} pages → ${SITE_ORIGIN}`)
