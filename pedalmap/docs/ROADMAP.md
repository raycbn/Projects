# ROADMAP — PedalMap

## FASE 1 — MVP ✅

- Landing PedalMap
- Mapa MapLibre real
- Geocoding Nominatim (+ Photon fallback)
- Routing ORS A→B / ida y vuelta
- Distancia, tiempo, desnivel positivo ciclista, elevación
- Superficie / tipo de vía (extra_info ORS) estilo Strava
- Waypoints básicos
- Auth email/Google/reset + guest planner
- Guardar rutas Firestore
- Compartir `/route/:shareSlug`
- SEO páginas útiles
- Tests + docs

## FASE 2 ✅

- GPX import/export en UI del planificador
- Edición avanzada / reordenar waypoints + recalcular
- Rutas circulares reales (`ORS round_trip`)

## FASE 3 ✅

- Preferencias con soporte real ORS (green / steepness / perfiles)
- Alternativas de ruta ORS (`alternative_routes`)
- Perfil ciclista persistente (bici + prefs en Firestore)

## FASE 4 ✅ (scaffold desplegable)

- Premium UI + Stripe Checkout / Customer Portal (Cloud Functions)
- Webhook Stripe → `subscriptions/{uid}` + `users.plan`
- Límites freemium client + contadores server-side (`onRouteCreated`)
- Proxy Functions `orsProxy` para ocultar ORS_API_KEY

## FASE 5 ✅ (base)

- Actividades GPS (`/actividad`, `/actividades`)
- Geolocalización + track + desnivel positivo
- Persistencia Firestore `activities`

## FASE 6

- Comunidad, seguidores, segmentos, retos, rankings
