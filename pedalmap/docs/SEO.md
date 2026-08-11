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

1. ~~Prerender/SSG de `/` + guías~~ → `scripts/prerender.ts` (en cada `npm run build`)
2. Analytics opcional tras consentimiento: `VITE_PLAUSIBLE_DOMAIN` y/o `VITE_GA_MEASUREMENT_ID` en `.env.local`
3. Blog editorial ligero + rutas públicas indexables `/route/{slug}`
4. Verification meta GSC — ya hecha por DNS Dominio

## Operativa post–Search Console

1. Sitemap enviado + indexación de `/` (confirmado en Google) + guías clave
2. Esperar datos de Rendimiento; no lanzar Ads de pago aún
3. Bing Webmaster + mismo sitemap
4. `https://pedalmap.es/llms.txt` — ficha para motores / agentes IA (GEO)

## Publicidad orgánica y gratuita (prioridad)

### Esta semana (tú, 0 €)
1. **Bing Webmaster** — importa GSC o verifica y envía sitemap
2. **Perfiles de marca** con enlace a pedalmap.es: Instagram, TikTok, YouTube, Strava Club, LinkedIn
3. **3 posts útiles** (no solo “mira mi app”):
   - Cómo crear una ruta GPX y pasarla a Garmin/Wahoo
   - Ruta ejemplo Madrid / Barcelona (captura real del mapa PedalMap)
   - Free vs Premium en 30 segundos
4. **Comunidades** (aporta valor, no spam): foros bici ES, grupos Telegram/WhatsApp de grupetas, Reddit r/cycling + comunidades ES, Discord de ciclismo
5. **Directorios gratis**: Product Hunt, AlternativeTo, Softonic/similar ES si encaja, listas “alternativas a Komoot”
6. **Outreach 5–10 emails**: blogs/clubs ciclistas locales — “¿os paso una guía/ruta gratis para vuestra web?” a cambio de mención + enlace

### Contenido que más empuja SEO (nosotros en código cuando digas)
- Blog corto: GPX → Garmin, viento en ruta, Objetivo circular
- Más hubs solo si hay texto útil (Bilbao, Zaragoza, Málaga…) — nunca pueblos vacíos
- Rutas públicas indexables `/route/{slug}` cuando haya tracks reales compartidos

### GEO (aparecer en ChatGPT / Perplexity / AI Overviews)
- Mantener FAQ y `llms.txt` al día
- Menciones de marca en sitios reales (foros, blogs, Strava)
- Misma descripción de producto en todas partes: “planificador de rutas bici para España…”

## Keywords (calidad > volumen)

- crear ruta bicicleta / planificador rutas bici / crear ruta GPX
- rutas bicicleta Madrid | Barcelona | Valencia | Sevilla
- rutas MTB / gravel Madrid
- calcular desnivel ruta bici
