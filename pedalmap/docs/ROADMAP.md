# ROADMAP — PedalMap

## FASE 1 — MVP ✅
## FASE 2 ✅
## FASE 3 ✅
## FASE 4 ✅ (Worker + Stripe test; Hosting live en pedalmap-79b3a.web.app)

- Premium UI + Stripe Checkout / Portal / webhook
- Contadores server-side con borrado si Free supera límites
- Proxy `orsProxy` + flag cliente

## FASE 5 ✅

- GPS `/actividad` + historial `/actividades`

## FASE 6 ✅ (base comunitaria)

- Explorar: rutas públicas, ciclistas, seguidores, segmentos, retos, rankings
- `publicProfiles`, `follows`, `segments`, `challenges`, `rankings`
- Reglas + índices Firestore

## Freemium filtros

- Multi-select de preferencias
- Free: máx **2** filtros activos
- Premium: ilimitado

## Post-MVP (en curso en prod)

- Modo **Objetivo**: punto de partida + km + desnivel (ORS `round_trip` + seeds)
- Viento/meteo por ruta y día (**Open-Meteo**, gratis)
- Export GPX → compartir a apps GPS gratuitas (OsmAnd, Organic Maps, Garmin Connect, Wahoo)
