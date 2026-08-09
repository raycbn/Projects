# ARCHITECTURE — BikeRoute

## Capas

```
UI (React components / pages)
  ↓
Application Services (RouteService, AuthService, RouteRepository, EntitlementService)
  ↓
Adapters (RoutingProvider, GeocodingProvider)
  ↓
External APIs (OpenRouteService, Nominatim, Firebase)
```

La UI **no** importa SDKs de routing concretos.

## Dominio

Tipos centrales en `src/domain/types.ts`:

- `RouteDraft` / `SavedRoute`
- `Waypoint`, `ElevationPoint`, `RouteStats`
- `UserProfile`, freemium limits
- `RoutingRequest` / `RoutingResult`

Validación con Zod en `src/domain/schemas.ts`.

## Routing

Interfaz: `RoutingProvider`

```ts
calculateRoute(request): Promise<RoutingResult>
isConfigured(): boolean
```

Implementación MVP: `OpenRouteServiceProvider`  
Factory: `createRoutingProvider()` lee `VITE_ROUTING_PROVIDER`.

Futuro sin reescribir UI:

- GraphHopperProvider
- OSRMProvider
- ValhallaProvider

## Estado

- `AuthContext` — sesión Firebase + perfil
- `PlannerContext` — waypoints, draft, edit draft, status machine

Estados del planificador: `idle | searching | calculating | success | error | editing | saving`

La edición usa `editDraft` temporal hasta “Guardar cambios”.

## Firebase

| Producto | Uso |
|----------|-----|
| Auth | Google, email/password, anonymous |
| Firestore | users, routes, routeShares, favorites, activities, subscriptions |
| Storage | GPX del usuario (preparado) |
| Hosting | SPA `dist/` |
| Functions | (Fase 4) proxy API key + Stripe webhooks |

## Guest-first

1. Calcular rutas sin cuenta (límite local).
2. Guardar / sincronizar / exportar Premium → auth o paywall.
3. Anonymous auth opcional vía Firebase.

## Actividades / GPS (Fase 5)

Colección `activities` y tipos preparados. El planner no bloquea un futuro “Iniciar actividad”.

## SEO

- Landing + páginas long-tail con meta/OG/canonical (`usePageMeta`)
- `robots.txt` + `sitemap.xml`
- Contenido útil, no spam

## Performance

- Lazy load de `MapView` (MapLibre)
- Bundle separado del mapa
- Tiles OpenFreeMap en MVP (sin key)
