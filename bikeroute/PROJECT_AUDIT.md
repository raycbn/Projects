# PROJECT_AUDIT — BikeRoute

**Fecha:** 2026-08-09  
**Repositorio:** `raycbn/Projects` (rama base: `master`)  
**Estado:** Greenfield — no existe aplicación BikeRoute aún  
**Alcance de este documento:** análisis previo a implementación. Sin cambios estructurales de producto.

---

## 1. Resumen ejecutivo

El repositorio **no contiene** una aplicación web de rutas ciclistas.  
Lo único presente es un proyecto desktop no relacionado:

| Ítem | Hallazgo |
|------|----------|
| Contenido existente | `Aplicación de Control de Gastos Personales/` |
| Tecnología | Python + Tkinter + SQLite + Matplotlib |
| Commits | 1 (`Primer commit con el proyecto`) |
| Firebase | No existe |
| Frontend web | No existe |
| Variables de entorno | No existen |
| Tests | No existen |
| README / docs | No existen |
| Código reutilizable para BikeRoute | **Ninguno** |

**Conclusión:** BikeRoute debe construirse desde cero. El proyecto de gastos personales debe **conservarse intacto** (no destruir ni mezclar). BikeRoute vivirá en su propio directorio (propuesta: `bikeroute/`).

---

## 2. Arquitectura actual

```
/workspace (raycbn/Projects)
├── .git/
└── Aplicación de Control de Gastos Personales/
    ├── main.py                 # App Tkinter de control de gastos
    ├── gastos_personales.db    # SQLite local
    └── .idea/                  # Configuración JetBrains
```

- **No hay monorepo web**, ni `package.json`, ni Vite, ni Firebase.
- **No hay CI/CD**, ni hosting configurado.
- El repo parece un contenedor genérico de proyectos personales.

---

## 3. Tecnologías encontradas

| Área | Actual | Relevante para BikeRoute |
|------|--------|--------------------------|
| Lenguaje | Python 3 | No |
| UI | Tkinter | No |
| DB | SQLite | No |
| Gráficos | Matplotlib | No |
| Auth | — | — |
| Maps / GIS | — | — |
| Hosting | — | — |

**Stack propuesto (greenfield, según brief):**

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + componentes propios |
| Mapas | MapLibre GL JS + tiles OSM / MapTiler (free tier) |
| Estado | React Context + hooks (sin Redux) |
| Validación | Zod |
| Backend | Firebase Auth + Firestore + Storage + Hosting |
| Functions | Cloud Functions solo cuando sea necesario (proxy API keys, Stripe webhooks) |
| Routing engine | Abstraction `RoutingProvider` → OpenRouteService (MVP) |
| Geocoding | Nominatim / Photon (con rate limits) o ORS geocode |
| Testing | Vitest + React Testing Library + Playwright (E2E) |
| SEO | Vite + prerender/SSG híbrido o VitePress/landing estática + meta por ruta |

---

## 4. Estructura propuesta (aún no creada)

```
bikeroute/
├── apps/web/                    # Vite + React app
│   ├── src/
│   │   ├── app/                 # routing, providers, layout
│   │   ├── components/          # Map, RoutePlanner, ElevationChart…
│   │   ├── features/            # planner, routes, auth, premium, gpx
│   │   ├── services/            # application services
│   │   ├── adapters/            # RoutingProvider adapters
│   │   ├── domain/              # tipos Route, User, Subscription
│   │   ├── lib/                 # gpx, stats, analytics
│   │   └── pages/               # landing, planner, my-routes, SEO pages
│   ├── public/                  # robots.txt, sitemap.xml, og images
│   └── e2e/                     # Playwright
├── firebase/
│   ├── firestore.rules
│   ├── storage.rules
│   └── functions/               # proxy routing (opcional), Stripe
├── docs/                        # ARCHITECTURE, ROUTING_PROVIDER, etc.
├── .env.example
└── README.md
```

**Arquitectura de capas (obligatoria):**

```
UI Components
    ↓
Application Services (RouteService, AuthService, ShareService…)
    ↓
Route Engine Adapter (normaliza respuesta a modelo de dominio)
    ↓
RoutingProvider (interfaz)
    ↓
OpenRouteServiceProvider | GraphHopperProvider | OSRMProvider | ValhallaProvider
```

La UI **nunca** importa un SDK de proveedor concreto.

---

## 5. Problemas identificados

| # | Problema | Severidad | Acción |
|---|----------|-----------|--------|
| 1 | Repo sin app BikeRoute | Bloqueante | Scaffold completo |
| 2 | Proyecto de gastos en la raíz sin relación | Bajo | Conservar; no tocar |
| 3 | Sin `.gitignore` raíz útil para web/Firebase | Medio | Crear al scaffold |
| 4 | Sin documentación | Medio | Generar docs pedidas |
| 5 | Sin Firebase project vinculado | Bloqueante para auth/save | Requiere configuración del usuario |
| 6 | Sin API keys de routing | Bloqueante para cálculo real | Documentar; `.env.example` |
| 7 | Nombre de carpeta con espacios/acentos | Bajo | No renombrar sin pedirlo |
| 8 | Repo llamado `Projects` (genérico) | Info | BikeRoute como subproyecto |

---

## 6. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Límites free de ORS (2.000 directions/día) | Producto inutilizable si crece | Adapter + self-host ORS/Valhalla en Fase 3–4 |
| API keys en cliente | Abuso / quota burn | Proxy via Cloud Functions en producción |
| Nominatim ToS (no heavy use) | Geocoding bloqueado | Photon self-host o ORS geocode; debounce + cache |
| Tiles OSM públicos (tile.openstreetmap.org) | Uso no permitido a escala app | MapTiler / Stadia / Protomaps free tier |
| Firestore Spark limits | Lecturas/escrituras cortadas | Diseño de docs eficiente; Blaze cuando haga falta |
| SEO en SPA pura | Mal posicionamiento | Landing/SSG + meta + structured data; páginas SEO estáticas |
| Circular routes sin algoritmo | Expectativa rota | UI + contrato de dominio; stub documentado hasta Fase 3 |
| Stripe aún no implementado | Monetización incompleta | Architecture + paywall UI + entitlements en Firestore |
| CORS / ORS browser access | Routing desde cliente puede fallar | Preferir proxy backend |

---

## 7. Dependencias externas necesarias

### 7.1 Routing (crítico)

Comparativa (MVP España, ciclismo, bajo coste, comercial):

| Proveedor | Ciclismo | Elevación | API pública | API key | Free tier | Comercial | Self-host |
|-----------|----------|-----------|-------------|---------|-----------|-----------|-----------|
| **OpenRouteService** | Sí (road, mtb, regular, electric…) | Sí (SRTM) | Sí | Sí | 2.000 directions/día, 40/min | Sí (Standard) | Sí (Docker) |
| **GraphHopper** | Sí (bike, mtb, racingbike) | Sí | Sí | Sí | 500 credits/día | Free = **no comercial** | Sí (OSS core) |
| **OSRM** | Sí (perfil bicycle) | No nativa | Self-host | No (self-host) | — | Sí | Sí |
| **Valhalla** | Sí + costing dinámico | Sí | Self-host / demos | No (self-host) | — | Sí (MIT) | Sí |

**Recomendación MVP:** **OpenRouteService** como primer `RoutingProvider`.

**Motivos:**
1. Perfiles ciclistas maduros y opciones (evitar steps, steepness, etc.).
2. Elevación y geometría en la misma API.
3. Free tier usable para desarrollo y early MVP.
4. Uso comercial permitido en plan Standard (verificar ToS vigentes al integrar).
5. Self-host futuro sin cambiar la abstracción de la app.
6. GraphHopper free **no comercial** → descartado como primario si el producto se monetiza.
7. OSRM rápido pero débil en elevación/preferencias dinámicas.
8. Valhalla excelente a medio plazo como self-host (Fase 4+).

**Alternativa futura de coste cero a escala:** self-host Valhalla u ORS sobre extract Geofabrik España.

Detalle completo → documento `ROUTING_PROVIDER.md` (se creará en implementación).

### 7.2 Mapas / tiles

| Servicio | Uso | Key | Coste MVP |
|----------|-----|-----|-----------|
| MapLibre GL JS | Render mapa | No | 0 € |
| MapTiler / Stadia Maps | Tiles vector/raster | Sí | Free tier |
| OpenStreetMap data | Base cartográfica | — | Atribución obligatoria |

**No usar** `tile.openstreetmap.org` como tile server de producción de la app.

### 7.3 Geocoding / búsqueda de lugares

| Opción | Notas |
|--------|-------|
| ORS Geocoding | 1.000/día free; misma key |
| Nominatim | Strict usage policy; solo bajo volumen + User-Agent |
| Photon | Open-source; ideal self-host más adelante |

### 7.4 Backend

| Servicio | Uso | Coste MVP |
|----------|-----|-----------|
| Firebase Auth | Google + email/password + anonymous | Free (Spark) |
| Cloud Firestore | users, routes, shares… | Free quota |
| Firebase Storage | GPX opcionales / assets | Free quota |
| Firebase Hosting | SPA + páginas estáticas | Free quota |
| Cloud Functions | Proxy API key, webhooks Stripe | Requiere Blaze (pay-as-you-go; free quota) |

### 7.5 Monetización (preparar, no cobrar aún)

| Servicio | Estado |
|----------|--------|
| Stripe Checkout / Customer Portal | Arquitectura + env vars; sin pagos reales en Fase 1 |
| Affiliate link registry | Modelo de datos; sin enlaces falsos |

### 7.6 Analytics

| Opción | Notas |
|--------|-------|
| Firebase Analytics o Plausible | Eventos mínimos; consentimiento RGPD |

---

## 8. Costes potenciales (orden de magnitud)

### MVP desarrollo / early users (0–few hundred users)

| Concepto | Coste estimado |
|----------|----------------|
| Firebase Spark | **0 €** |
| OpenRouteService Standard | **0 €** (dentro de cuota) |
| Map tiles free tier | **0 €** |
| Dominio (.es / .com) | ~10–15 €/año |
| **Total operativo MVP** | **≈ 0–15 €/año** |

### Escalado temprano (cuando se agote ORS o Firebase)

| Concepto | Coste estimado |
|----------|----------------|
| Firebase Blaze (Functions + overrun) | variable; suele ser bajo al inicio |
| GraphHopper Basic (si se usara) | ~69 €/mes |
| VPS self-host Valhalla/ORS (España) | ~10–40 €/mes |
| MapTiler / Stadia plan pago | según tráfico |
| Stripe fees | % por transacción (cuando haya Premium) |

Documento detallado → `COSTS.md` (en implementación).

**Principio:** open source + free tiers primero; self-host routing antes que APIs de pago.

---

## 9. APIs / variables de entorno necesarias

```bash
# Frontend (Vite)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_MAP_STYLE_URL=          # MapTiler/Stadia style URL
VITE_ROUTING_PROVIDER=openrouteservice
VITE_USE_ROUTING_PROXY=true  # preferir proxy en prod

# Solo servidor / Functions (NUNCA en cliente)
ROUTING_API_KEY=             # OpenRouteService
STRIPE_SECRET_KEY=           # futuro
STRIPE_WEBHOOK_SECRET=       # futuro
```

- `.env` en `.gitignore`
- Proveer `.env.example` sin secretos

---

## 10. Modelo de datos Firestore (propuesto)

```
users/{uid}
  - email, displayName, photoURL
  - plan: 'free' | 'premium'
  - bikePreferences: { bikeType, preferences[] }
  - usage: { routesCreatedThisMonth, routesSaved }
  - createdAt, updatedAt

routes/{routeId}
  - userId, title, description, type (a_to_b | circular | out_and_back)
  - bikeType, distanceMeters, elevationGainMeters, elevationLossMeters
  - estimatedDurationSeconds, difficulty
  - geometry (GeoJSON LineString o encoded)
  - elevationProfile[], waypoints[]
  - surfaceStats?, isPublic, shareSlug
  - createdAt, updatedAt

routeShares/{shareSlug}
  - routeId, userId, createdAt, expiresAt?

favorites/{uid}/items/{routeId}
activities/{activityId}          # preparado Fase 5
subscriptions/{uid}              # preparado Stripe
affiliateLinks/{id}              # preparado growth
```

Security Rules: propietario r/w; lectura pública solo si `isPublic` o vía `routeShares`.

---

## 11. Propuesta de arquitectura de producto

### Principios
1. **Guest-first:** calcular rutas sin registro.
2. **Sin fake data:** si falta API key, UI clara de “routing no configurado”.
3. **Adapters:** cambiar proveedor sin reescribir UI.
4. **Freemium preparado:** límites en modelo + paywall; Stripe después.
5. **SEO real:** páginas de contenido útiles, no spam.
6. **RGPD:** minimización, consentimiento, política de privacidad.

### Flujos Fase 1
1. Landing → CTA “Crear una ruta”
2. `/route-planner` → mapa + inicio/destino → Crear ruta
3. Ver stats + elevación
4. Guardar → auth gate si guest
5. `/my-routes` → listar / abrir / compartir (básico)

### Lo que NO se implementa en Fase 1
- Pagos Stripe reales
- Navegación GPS en actividad
- Algoritmo circular avanzado (solo contrato/UI stub)
- Comunidad / segmentos
- Mapas offline

---

## 12. Roadmap por fases

### FASE 1 — MVP (siguiente tras confirmación)
- Scaffold React/TS/Vite + Tailwind
- MapLibre mapa
- Búsqueda ubicación + A→B routing (ORS adapter)
- Stats básicas + elevation profile
- Auth (Google, email, anonymous)
- Guardar rutas (Firestore)
- Landing profesional
- Docs: ARCHITECTURE, ROUTING_PROVIDER, COSTS, SECURITY, ROADMAP, SEO, MONETIZATION
- Tests unitarios núcleo (GPX prep, stats, validation)
- `.env.example`, Firebase rules

### FASE 2
- Edición / waypoints / recalcular
- GPX import/export + tests
- Share público `/route/[shareSlug]`
- Out-and-back

### FASE 3
- Preferencias ciclista completas
- Circular (algoritmo real)
- Superficie / % asfaltado cuando el proveedor lo dé
- Mejoras planner UX móvil

### FASE 4
- Premium entitlements + paywall
- Stripe
- Analytics eventos
- Proxy Functions + rate limits

### FASE 5
- Actividades / GPS / navegación
- Estadísticas personales

### FASE 6
- Comunidad, rankings, retos, seguidores, segmentos

---

## 13. Qué conservar / qué cambiar

| Decisión | Detalle |
|----------|---------|
| **Conservar** | Carpeta `Aplicación de Control de Gastos Personales/` sin modificar |
| **Conservar** | Historial git existente |
| **Crear** | Nuevo directorio `bikeroute/` (o raíz dedicada si se prefiere repo split) |
| **No hacer** | Reescribir o borrar el proyecto de gastos |
| **No hacer** | Inventar endpoints o datos de ruta falsos como reales |
| **No hacer** | Implementar pagos reales sin infraestructura |

---

## 14. Bloqueos externos (requieren acción del usuario)

Para que el routing y el guardado reales funcionen, hace falta:

1. **Cuenta HeiGIT / OpenRouteService** → API key  
2. **Proyecto Firebase** → Auth (Google + Email) + Firestore + Hosting  
3. **Proveedor de tiles** (MapTiler/Stadia) → style URL + key  
4. (Opcional Fase 4) **Stripe** + plan Blaze Firebase para Functions  

Hasta entonces: la app puede scaffolded, UI completa, adapters con estado `not_configured`, y tests offline (GPX, stats, Zod).

---

## 15. Criterio de producto (filtro continuo)

> ¿Esto ayuda realmente a un ciclista a planificar una ruta mejor?

Si no → no se añade.

Prioridad absoluta del MVP: **crear ruta A→B excelente**, clara, rápida, honesta con los datos.

---

## 16. Próximo paso (pendiente de confirmación)

Tras tu OK, la FASE 1 arrancará con:

1. Crear `bikeroute/` scaffold (Vite + React + TS + Tailwind)
2. Documentación restante (`ARCHITECTURE.md`, `ROUTING_PROVIDER.md`, etc.)
3. Dominio + adapters `RoutingProvider`
4. UI planner + mapa + landing
5. Firebase scaffolding (rules, tipos) sin asumir proyecto ya creado
6. Tests del núcleo
7. README de instalación

**Esperando confirmación antes de cambios estructurales importantes.**
