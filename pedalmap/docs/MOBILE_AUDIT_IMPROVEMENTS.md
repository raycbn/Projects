# PedalMap — auditoria movil + roadmap

Fecha: 2026-08-10. Revision como uso real en movil (~390px) + codigo.

## Hallazgos corregidos en este lote

### P0
- Elevacion falsa a 600 m cuando Valhalla `/height` falla → ahora perfil vacio + UI "sin datos".
- Free `advancedCircular` incoherente con tests/paywall → Free bloqueado; Premium vende Objetivo de verdad.
- Contadores freemium muertos (sin Functions en Spark) → `recordRouteCreated` / `recordRouteSaved` en cliente.
- Guest creates solo en memoria → `localStorage`.
- Paywall de filtros al calcular (race) → clamp silencioso.

### P1
- Cambio de modo dejaba waypoints/destino obsoletos → limpia draft + puntos no validos.
- CTA siempre activo sin inicio/destino → disabled + copy claro.
- "Pedir alternativas ORS" mentia → copy generico.
- Preferencias con jerga ORS → copy Valhalla/usuario.
- Superficie "OSM · ORS" → "OSM · Valhalla".
- Worker no aplicaba `prefer_secondary_roads` / `avoid_traffic` → aplicado.
- Mapa no setea puntos al tocar → tap inicio/destino/via + hint.
- Sin "Estoy aqui" → boton geolocation.
- Objetivo sin variantes → "Otra variante" (`circularSeed`).
- Tabbar comia mapa en planner → oculto en `/route-planner`.
- Safe-area sticky CTA + tabbar height.
- GPS no recibía geometria → handoff `sessionStorage`.
- Premium vendia "estadisticas avanzadas" inexistentes → lista honesta.

### Mejoras nuevas shipadas
1. Tap en mapa para puntos
2. Estoy aqui
3. Otra variante (Objetivo)
4. Indicaciones turn-by-turn (Valhalla)
5. Persistencia ultima ruta (localStorage)
6. Contadores de uso reales en Firestore
7. Handoff GPS con geometria planificada

## Roadmap priorizado (siguiente)

### Alto impacto
1. **Linea de ruta coloreada por superficie** (asfalto/tierra/desconocido) encima del mapa.
2. **Navegacion guiada** con flecha + voz + off-route (sobre las instructions ya guardadas).
3. **Comparador de bici**: misma A→B con road vs gravel vs MTB en un gesto.
4. **Guardar borrador en nube** (no solo local) al iniciar sesion.
5. **Share card** imagen OG de la ruta (distancia/desnivel/idoneidad) para WhatsApp.

### Medio
6. Offline tiles / cache de la ultima ruta para zonas sin cobertura.
7. Ajuste fino Objetivo (±10% distancia) con mas seeds y feedback visual del error.
8. Wind declutter: modo "solo cola/cara" sin flechas densas en zoom bajo.
9. Importar ruta desde Strava/Komoot link.
10. Alertas de superficie "cuidado: 1.2 km sin asfaltar" antes de salir.

### Comercial / infra
11. Activar `STADIA_API_KEY` en Worker (SLA comercial Valhalla).
12. Stripe live + webhook premium fiable.
13. Dominio propio + PWA install prompt.
14. Telemetria de funnels (calculo → save → premium).

## QA manual pendiente en telefono
- A→B road/gravel/MTB + superficie
- Ida-vuelta
- Objetivo guest vs Free signed-in (paywall)
- Tap mapa + Estoy aqui + Otra variante
- Viento overlay
- Guardar + contadores
- Iniciar GPS desde planner
