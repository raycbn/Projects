# ROUTING_PROVIDER — PedalMap

## Arquitectura comercial (superficie por bici)

**Problema:** OpenRouteService **no puede** evitar superficies en perfiles `cycling-*`
(decisión de HeiGIT: OSM paved/unpaved poco fiable para hard-filter). PedalMap solo
podía **rankear a posteriori** → rutas “pésimas” para carretera/gravel/MTB.

**Solución estable:** **Valhalla** como motor A→B (costing nativo por tipo de bici +
`avoid_bad_surfaces`), **ORS** para circulares (`round_trip`) y fallback.

| Rol | Motor | Por qué |
|-----|-------|---------|
| A→B / ida-vuelta | **Valhalla** | `bicycle_type` Road/Hybrid/Cross/Mountain + `avoid_bad_surfaces` cambia el grafo |
| Circular / Objetivo | **ORS** | `options.round_trip` (Valhalla no tiene equivalente 1:1) |
| Fallback | **ORS** | Si Valhalla cae, la app sigue calculando |

Factory: `VITE_ROUTING_PROVIDER=composite` (default) → `CompositeRoutingProvider`.

### Mapeo PedalMap → Valhalla

| Bici | `bicycle_type` | `avoid_bad_surfaces` | Notas |
|------|----------------|----------------------|-------|
| Carretera | Road | 1.0 | Disallow suelo malo |
| Urbana | Hybrid | 0.92 | Ciudad + buen pavimento |
| E-bike | Hybrid | 0.88 | Más hills OK |
| Gravel | Cross | 0.28 | Mezcla compacta/grava |
| MTB | Mountain | 0.05 | Tierra/sendero OK |

Tras la ruta: `trace_attributes` → composición de superficie; `/height` → desnivel.

### Hosting Valhalla (coste)

| Etapa | Upstream | Coste | Comercial |
|-------|----------|-------|-----------|
| MVP / dev | FOSSGIS `valhalla1.openstreetmap.de` via Worker | 0 € | Fair-use; no depender a largo plazo |
| Producción | **Stadia Maps** (`STADIA_API_KEY`) | desde ~20 $/mes | Sí |
| Escala UE | Self-host Valhalla (extract España) | ~10–40 €/mes VPS | Sí |

Worker endpoints:
- `POST /valhalla/route`
- `POST /valhalla/trace_attributes`
- `POST /valhalla/height`
- `POST /v2/directions/{cycling-*}/geojson` (ORS)

### ORS (legado / circular)

| Ítem | Detalle |
|------|---------|
| Base | `https://api.heigit.org/openrouteservice` |
| Free | ~2.000 directions/día, 40/min |
| Key | Solo en Worker (`ORS_API_KEY`) |

## Tiles / mapa

| Ítem | Detalle |
|------|---------|
| Render | MapLibre GL JS |
| Tiles MVP | OpenFreeMap liberty |
| Swap | `VITE_MAP_STYLE_URL` |

## Geocoding

1. Nominatim (primario)
2. Photon (fallback)

## Abstracción

```
UI → RouteService → CompositeRoutingProvider
                      ├─ ValhallaProvider (A→B, surface-aware)
                      └─ OpenRouteServiceProvider (circular + fallback)
```
