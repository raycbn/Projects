# ROUTING_PROVIDER — PedalMap

## Routing elegido (MVP)

**OpenRouteService (ORS)** — HeiGIT

| Ítem | Detalle |
|------|---------|
| Motivo | Perfiles ciclistas + elevación + free tier usable + comercial en Standard |
| API | `POST /v2/directions/{profile}/json` |
| Key | `VITE_ORS_API_KEY` (nunca en Git) |
| Free | ~2.000 directions/día, 40/min |
| Self-host | Docker ORS / Valhalla como alternativa futura |

### Mapeo tipo de bici → perfil ORS

| PedalMap | ORS | Notas |
|----------|-----|-------|
| Carretera | `cycling-road` | Soporte real |
| MTB | `cycling-mountain` | Soporte real |
| E-bike | `cycling-electric` | Soporte real |
| Gravel | `cycling-regular` | **Sin perfil gravel dedicado** |
| Urbana | `cycling-regular` | Sin perfil urban dedicado |

### Preferencias aplicadas de verdad

| Preferencia UI | ORS |
|----------------|-----|
| Menor distancia | `preference: shortest` |
| Más rápida | `preference: fastest` |
| Menor desnivel | `weightings.steepness_difficulty: 0` |

### Preferencias NO simuladas (próximamente)

Carril bici, evitar principales, evitar tráfico, asfalto/caminos: ORS no las expone de forma fiable en cycling. Se documentan deshabilitadas en UI hasta GraphHopper custom model / Valhalla costing / self-host.

### Circular

No implementado. La UI lo indica honestamente. Fase posterior.

## Tiles / mapa

| Ítem | Detalle |
|------|---------|
| Render | MapLibre GL JS |
| Tiles MVP | **OpenFreeMap** `https://tiles.openfreemap.org/styles/liberty` |
| Key | No |
| Swap | `VITE_MAP_STYLE_URL` / `src/lib/mapTiles.ts` |
| Producción alta | MapTiler / Stadia / self-host — documentar ToS y tráfico |

No usar `tile.openstreetmap.org` como tile server de app.

## Geocoding

Nominatim (fair use) vía `NominatimProvider`. Sustituible por Photon/ORS geocode.

## Alternativas futuras

1. Valhalla self-host (España) — costing dinámico + elevación
2. OSRM — velocidad, elevación externa
3. GraphHopper — free no comercial; paid o OSS self-host
