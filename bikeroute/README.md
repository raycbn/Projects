# BikeRoute

Aplicación web para **crear, descubrir, guardar, compartir y exportar rutas de bicicleta**.

> Guest-first · mapa real · routing real · Firebase · freemium preparado · SEO útil

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- MapLibre GL + OpenFreeMap tiles
- Firebase Auth / Firestore / Hosting
- OpenRouteService (adapter `RoutingProvider`)
- Zod · Vitest · Playwright

## Arquitectura

```
UI → Application Services → Route Engine Adapter → RoutingProvider
```

Ver `ARCHITECTURE.md` y `ROUTING_PROVIDER.md`.

## Instalación

```bash
cd bikeroute
npm install
cp .env.example .env
# Completa Firebase + VITE_ROUTING_API_KEY (OpenRouteService)
npm run dev
```

Abre `http://localhost:5173`.

## Variables de entorno

Copia `.env.example` → `.env`.

| Variable | Descripción |
|----------|-------------|
| `VITE_FIREBASE_*` | Config web de Firebase |
| `VITE_ROUTING_API_KEY` | API key OpenRouteService |
| `VITE_MAP_STYLE_URL` | Style JSON MapLibre (OpenFreeMap por defecto) |
| `VITE_GEOCODER_CONTACT_EMAIL` | Contacto Nominatim (recomendado) |

**Nunca subas `.env`.**

## Firebase

1. Crea un proyecto Firebase
2. Activa Authentication (Google, Email/Password, Anonymous)
3. Crea Firestore
4. Copia la config web a `.env`
5. Despliega rules:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use <project-id>
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

Hosting:

```bash
npm run build
npx -y firebase-tools@latest deploy --only hosting
```

## APIs

| API | Uso | Key |
|-----|-----|-----|
| OpenRouteService | Routing ciclista + elevación | Sí |
| Nominatim | Geocoding (fair use) | No |
| OpenFreeMap | Tiles mapa | No |
| Firebase | Auth, DB, hosting | Sí |

Sin `VITE_ROUTING_API_KEY`, el planificador muestra un error claro de configuración (no inventa rutas).

## Scripts

```bash
npm run dev          # desarrollo
npm run build        # producción
npm run preview      # preview local
npm run test         # Vitest
npm run test:e2e     # Playwright (requiere build)
npm run lint         # oxlint
```

## Testing

- Unit: stats, GPX, schemas, entitlements
- E2E smoke: landing + planner UI

```bash
npm run test
npm run build && npx playwright install chromium && npm run test:e2e
```

## Documentación

- `PROJECT_AUDIT.md`
- `ARCHITECTURE.md`
- `ROUTING_PROVIDER.md`
- `COSTS.md`
- `SEO.md`
- `MONETIZATION.md`
- `SECURITY.md`
- `ROADMAP.md`

## Principio de producto

¿Ayuda a un ciclista a planificar mejor su ruta? Si no — no se añade.
