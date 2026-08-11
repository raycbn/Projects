# SEO & GEO — PedalMap

## Objetivo

Salir en Google (España, ciclismo) y ser citables por motores generativos (ChatGPT, Perplexity, Gemini, AI Overviews) como **el planificador de rutas bici en España** (mapa + desnivel + viento + superficie + GPX).

## Hecho en código (esta fase)

- Dominio canónico unificado: **https://pedalmap.es** (`index.html`, `robots.txt`, `sitemap.xml`, `usePageMeta`)
- OG/Twitter + imagen `/og-default.jpg`
- JSON-LD: `Organization` + `SoftwareApplication` + `FAQPage` (landing) y `WebPage` (guías)
- `noindex` en rutas privadas + `Disallow` en robots
- Guías enriquecidas + hubs locales: Madrid (bici/MTB/gravel), Barcelona, Valencia, Sevilla
- Enlaces internos en footer, Explorar → Guías y “Sigue explorando”

## Qué hacer tú (cuenta / ads) — orden

1. **Google Search Console** (pantalla “Selecciona el tipo de propiedad”):
   - Elige **Dominio** (izquierda), no “Prefijo de la URL”
   - Escribe solo: `pedalmap.es` (sin `https://`, sin `www`)
   - CONTINUAR → Google te da un registro **TXT** → añádelo en DNS de IONOS → Verifica
   - Luego: Sitemaps → `https://pedalmap.es/sitemap.xml`
2. **Bing Webmaster** (opcional) con el mismo sitemap
3. Hosts legacy (`*.web.app`, `*.firebaseapp.com`, `www`) redirigen a `pedalmap.es` desde el HTML/SW (Firebase no ofrece 301 por hostname en `firebase.json`)
4. **Publicidad** (después de GSC midiendo):
   - Google Ads Search: campañas exactas en “crear ruta bicicleta”, “planificador rutas bici”, “crear ruta GPX” → landing `/crear-ruta-bicicleta` etc.
   - Presupuesto bajo al inicio; landing = página SEO, no solo `/`
   - Meta/Instagram solo cuando haya creatividades de producto (mapa real), no genéricas
5. **GEO / autoridad**: 2–4 artículos reales al mes (salidas, cómo exportar a Garmin/Wahoo, viento en ruta) cuando haya blog; hasta entonces, guías + FAQ claras

## No hacer

- Miles de páginas vacías por pueblo
- Keyword stuffing
- Comprar backlinks basura
- Indexar `/my-routes`, login, navegación

## Siguiente fase técnica (código)

1. Prerender/SSG de `/` + guías (máximo impacto crawl)
2. Analytics real (Plausible o GA4) detrás del consentimiento
3. Blog editorial ligero + rutas públicas indexables `/route/{slug}`
4. Verification meta GSC cuando tengas el código

## Keywords (calidad > volumen)

- crear ruta bicicleta / planificador rutas bici / crear ruta GPX
- rutas bicicleta Madrid | Barcelona | Valencia | Sevilla
- rutas MTB / gravel Madrid
- calcular desnivel ruta bici
