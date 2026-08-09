# ROUTING_PROVIDER — Decisión técnica

## Proveedor elegido (MVP)

**OpenRouteService (ORS)** — HeiGIT

### Motivo

1. Perfiles ciclistas maduros: `cycling-road`, `cycling-mountain`, `cycling-regular`, `cycling-electric`.
2. Elevación en la misma petición (`elevation: true`).
3. Free tier usable: **2.000 directions/día**, 40/min.
4. Uso comercial permitido en plan Standard (verificar ToS vigentes).
5. Self-host Docker disponible para salir del free tier sin reescribir la app.
6. Opciones útiles: evitar steps, steepness, preference shortest/fastest.

### API

- Base: `https://api.openrouteservice.org` (migración HeiGIT `api.heigit.org` en curso — monitorizar)
- Endpoint usado: `POST /v2/directions/{profile}/json`
- Auth: header `Authorization: <API_KEY>`
- Key: cuenta gratuita en openrouteservice.org → `VITE_ROUTING_API_KEY`

### Limitaciones

- Cuota diaria/minuto
- Controles de superficie/tráfico limitados vs preferencias de producto
- Posibles restricciones CORS desde navegador → **proxy Cloud Functions recomendado en producción**
- Rutas circulares por distancia: **no implementadas aún** (Fase 3); el adapter lanza `invalid_request` honesto

### Coste

- Standard: **0 €** dentro de cuota
- On-premise: coste de VPS (~10–40 €/mes para extract España)

### Alternativas futuras

| Provider | Cuándo | Notas |
|----------|--------|-------|
| **Valhalla** self-host | Escala / costing dinámico | MIT, elevación, bicycle costing |
| **OSRM** self-host | Ultra baja latencia A→B | Elevación no nativa |
| **GraphHopper** cloud | Si se asume coste | Free = no comercial |
| GraphHopper OSS | Self-host | Apache 2.0 core |

## Abstracción

```
src/adapters/routing/RoutingProvider.ts          # interfaz
src/adapters/routing/OpenRouteServiceProvider.ts # MVP
src/adapters/routing/createRoutingProvider.ts    # factory
```

Cambiar proveedor = nueva clase + valor en `VITE_ROUTING_PROVIDER`.
