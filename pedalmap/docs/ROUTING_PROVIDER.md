# ROUTING_PROVIDER — PedalMap

## Routing elegido (MVP)

**OpenRouteService via HeiGIT**

| Ítem | Detalle |
|------|---------|
| Base URL recomendada | `https://api.heigit.org/openrouteservice` (**sin** trailing slash) |
| Endpoint directions | `POST /v2/directions/{profile}/geojson` (elevación 3D) |
| Key (dev) | `VITE_ORS_API_KEY` (nunca en Git) |
| Proxy (prod) | Cloud Function `orsProxy` + `VITE_USE_ROUTING_PROXY=true` |
| Legacy (deprecado) | `https://api.openrouteservice.org` — shut-off previsto **2026-08-24** |
| Free | ~2.000 directions/día, 40/min |

### Mapeo tipo de bici → perfil ORS

| PedalMap | ORS | Notas |
|----------|-----|-------|
| Carretera | `cycling-road` | Fallback → `cycling-regular` si 503 |
| MTB | `cycling-mountain` | Fallback → `cycling-regular` |
| E-bike | `cycling-electric` | Fallback → `cycling-regular` |
| Gravel | `cycling-regular` | Sin perfil gravel dedicado |
| Urbana | `cycling-regular` | Sin perfil urban dedicado |

### Preferencias aplicadas de verdad

| Preferencia UI | ORS |
|----------------|-----|
| Menor distancia | `preference: shortest` |
| Más rápida | `preference: fastest` |
| Menor desnivel | `weightings.steepness_difficulty: 0` |
| Priorizar caminos | perfil `cycling-mountain` + steepness |
| Evitar sin asfaltar | sesgo a `cycling-regular` |
| Carril bici | `cycling-regular` + `weightings.green` |
| Secundarias / evitar principales | `weightings.green` (ORS cycling no admite `avoid highways`) |
| Evitar ferry/vado | `avoid_features: ferries, fords` (+ steps siempre) |

### Desnivel positivo ciclista

ORS DEM puede devolver ceros aislados → se sanitiza, se suaviza y se aplica umbral ~10 m
(estilo Strava DEM) antes de sumar el **desnivel +**.

### Circular / alternativas

- Circular: `options.round_trip`
- Alternativas: `alternative_routes` (A→B)

## Tiles / mapa

| Ítem | Detalle |
|------|---------|
| Render | MapLibre GL JS |
| Tiles MVP | OpenFreeMap `https://tiles.openfreemap.org/styles/liberty` |
| Swap | `VITE_MAP_STYLE_URL` / `src/lib/mapTiles.ts` |

## Geocoding

1. **Nominatim** (primario)
2. **Photon** (fallback automático)

## Abstracción

```
UI → RouteService → RoutingProvider → OpenRouteServiceProvider (HeiGIT o orsProxy)
```
