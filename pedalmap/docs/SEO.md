# SEO & GEO — PedalMap

## Objetivo

Salir en Google (España, ciclismo) **más allá de la marca** “PedalMap”, y ser citables por motores generativos (ChatGPT, Perplexity, Gemini, AI Overviews) como planificador de rutas bici en España (mapa + desnivel + viento + superficie + GPX).

## Hecho en código

- Dominio canónico **https://pedalmap.es** (`index.html`, `robots.txt`, `sitemap.xml`, `usePageMeta`)
- OG/Twitter + `/og-default.jpg`
- JSON-LD: Organization + SoftwareApplication + FAQPage (landing) + WebPage/FAQ en guías + BlogPosting
- `noindex` en privadas + `Disallow` en robots
- Guías de intención: crear ruta, planificador, GPX, gravel, MTB, circular, alternativa Komoot, “mejor planificador ES”
- Hubs ciudad: Madrid (+ MTB/gravel), Barcelona (+ MTB/gravel), Valencia, Sevilla, Bilbao, Zaragoza, Málaga, Granada, Alicante, Murcia, Santander, Córdoba, Valladolid, Pamplona, Palma
- Blog editorial (16+ posts) con CTAs al producto
- Prerender en `npm run build` (`scripts/prerender.ts`)
- `https://pedalmap.es/llms.txt` para GEO / agentes
- Enlaces internos: footer, Explorar (guías prácticas vs ciudades), “Sigue explorando”

## Operativa tuya (cuenta)

1. **Google Search Console** (propiedad Dominio `pedalmap.es`) → Sitemaps → `https://pedalmap.es/sitemap.xml` (reenviar tras cada lote grande)
2. **Bing Webmaster** (mismo sitemap) cuando puedas
3. Hosts legacy redirigen a `pedalmap.es` desde HTML/SW
4. **No Ads de pago** hasta ver consultas reales en GSC; si algún día Ads: landings SEO (`/crear-ruta-bicicleta`, `/alternativa-komoot`), no solo `/`
5. Pack orgánico diario: `docs/ORGANIC_GROWTH.md`

## No hacer

- Miles de páginas vacías por pueblo
- Keyword stuffing / “mejor app del mundo” vacío
- Comprar backlinks basura
- Indexar `/my-routes`, login, navegación, actividades privadas

## Siguiente fase de contenido (cuando GSC dé señales)

1. Reforzar las 5 keywords que ya estén en página 2–3 (más enlaces internos + un párrafo útil)
2. 1 ruta pública indexable `/route/{slug}` cuando haya tracks reales compartidos
3. Actualizar `sameAs` en Organization JSON-LD con IG/TikTok/Strava cuando existan
4. Más hubs solo con texto útil (nunca pueblos vacíos)

## Keywords (prioridad)

| Intención | URL principal |
|-----------|----------------|
| crear ruta bicicleta | `/crear-ruta-bicicleta` |
| planificador rutas bici | `/planificador-rutas-bici` |
| crear ruta GPX | `/crear-ruta-gpx` |
| gravel / MTB | `/planificador-rutas-gravel`, `/planificador-rutas-mtb` |
| ruta circular | `/ruta-circular-bicicleta` |
| alternativa Komoot | `/alternativa-komoot` |
| mejor planificador ES | `/mejor-planificador-rutas-bici` |
| local | `/rutas-bicicleta-{ciudad}` |
