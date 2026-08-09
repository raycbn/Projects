# ROUTING_PROVIDER — PedalMap

## Routing elegido (MVP)

**OpenRouteService via HeiGIT**

| Ítem | Detalle |
|------|---------|
| Base URL recomendada | `https://api.heigit.org/openrouteservice` (**sin** trailing slash) |
| Endpoint directions | `POST /v2/directions/{profile}/json` |
| URL completa ejemplo | `https://api.heigit.org/openrouteservice/v2/directions/cycling-road/json` |
| Key | `VITE_ORS_API_KEY` (nunca en Git) |
| Legacy (deprecado) | `https://api.openrouteservice.org` — shut-off previsto **2026-08-24** |
| Free | ~2.000 directions/día, 40/min |
| Self-host | Docker ORS / Valhalla como alternativa futura |

Referencia: [HeiGIT deprecation notice](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912)

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

### Preferencias NO simuladas

Carril bici, evitar principales, tráfico, asfalto/caminos: deshabilitadas en UI hasta un motor que las soporte.

### Circular

No implementado. Mensaje honesto en UI.

## Tiles / mapa

| Ítem | Detalle |
|------|---------|
| Render | MapLibre GL JS |
| Tiles MVP | OpenFreeMap `https://tiles.openfreemap.org/styles/liberty` |
| Swap | `VITE_MAP_STYLE_URL` / `src/lib/mapTiles.ts` |

## Geocoding

1. **Nominatim** (primario) — fair use; puede devolver 403 a IPs de datacenter.
2. **Photon** (fallback automático) — `https://photon.komoot.io` si Nominatim falla.

Producción a escala: Photon self-host o HeiGIT Pelias (`api.heigit.org/pelias/v1`).

## Abstracción

```
UI → RouteService → RoutingProvider → OpenRouteServiceProvider (HeiGIT)
```
