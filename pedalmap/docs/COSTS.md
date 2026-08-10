# COSTS — PedalMap

Objetivo MVP: **lo más barato posible** sin romper arquitectura de producto.

## Coste operativo estimado (MVP / early)

| Servicio | Plan | Coste |
|----------|------|-------|
| Firebase Auth + Firestore + Hosting | Spark | 0 € |
| OpenRouteService (circular + fallback) | Standard free | 0 € |
| Valhalla bike A→B (FOSSGIS via Worker) | Fair-use público | 0 € |
| Map tiles (OpenFreeMap) | Público | 0 € |
| Nominatim geocoding | Fair use | 0 € |
| Dominio | opcional | ~10–15 €/año |
| **Total early** | | **≈ 0–15 €/año** |

## Producción comercial (superficie por bici)

ORS **no** filtra suelos en `cycling-*`. PedalMap usa **Valhalla** en A→B.

| Opción | Coste | Notas |
|--------|-------|-------|
| Stadia Maps (Valhalla managed) | desde ~20 $/mes | Poner `STADIA_API_KEY` en el Worker |
| Self-host Valhalla (Geofabrik ES) | ~10–40 €/mes VPS | Control total, updates OSM |
| FOSSGIS público | 0 € | Solo MVP/dev; no es SLA comercial |

Ver `docs/ROUTING_PROVIDER.md`.

## Cuotas relevantes

### Firebase Spark

- Firestore: 50k reads / 20k writes / día
- Hosting: 10 GB storage, 360 MB transfer/día
- Auth email/Google/anonymous: incluido

### OpenRouteService Standard

- Directions: 2.000 / día, 40 / min

### Nominatim

- ~1 req/s, User-Agent/email, sin uso masivo

## Escalado barato (recomendado)

1. Cloudflare Worker proxy (ORS + Valhalla + Stripe) — sin Blaze
2. Cache de rutas/geocodes frecuentes
3. Stadia Maps o self-host Valhalla España
4. Tiles: OpenFreeMap → MapTiler/Stadia según tráfico

## Costes a evitar al inicio

- GraphHopper Basic (~69 €/mes) salvo custom models propios
- Google Maps Platform
- Firebase Blaze solo “por si acaso”

## Stripe

- Sin coste fijo relevante
- Comisión por transacción
- Webhooks vía Cloudflare Worker (Spark OK)
