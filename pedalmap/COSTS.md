# COSTS — PedalMap

Objetivo MVP: **lo más barato posible** sin romper arquitectura.

## Coste operativo estimado (MVP / early)

| Servicio | Plan | Coste |
|----------|------|-------|
| Firebase Auth + Firestore + Hosting | Spark | 0 € |
| OpenRouteService Directions | Standard free | 0 € |
| Map tiles (OpenFreeMap) | Público | 0 € |
| Nominatim geocoding | Fair use | 0 € |
| Dominio | opcional | ~10–15 €/año |
| **Total** | | **≈ 0–15 €/año** |

## Cuotas relevantes

### Firebase Spark (orden de magnitud)

- Firestore: 50k reads / 20k writes / día
- Hosting: 10 GB storage, 360 MB transfer/día
- Auth email/Google/anonymous: incluido

Al superar cuotas en Spark, el servicio se corta (no factura). Para Functions/Stripe → Blaze.

### OpenRouteService Standard

- Directions: 2.000 / día, 40 / min
- Elevation linestrings: 200 / día
- Geocoding: 1.000 / día

### Nominatim

- No es un free tier comercial ilimitado
- ~1 req/s, User-Agent/email, sin uso masivo
- Sustituir por Photon self-host u ORS geocode al crecer

## Escalado barato (recomendado)

1. Proxy routing en Cloud Functions (protege API key)
2. Cache de rutas/geocodes frecuentes
3. Self-host Valhalla u ORS con extract Geofabrik **Spain** (~10–40 €/mes VPS)
4. Tiles: MapTiler/Stadia free → pago según tráfico

## Costes a evitar al inicio

- GraphHopper Basic (~69 €/mes) salvo necesidad
- Google Maps Platform (no necesario)
- Generar miles de páginas SEO basura (coste de crawl/reputación)

## Stripe (Fase 4)

- Sin coste fijo relevante
- Comisión por transacción estándar Stripe
- Webhooks en Cloud Functions (Blaze)
