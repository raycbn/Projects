# PedalMap

Aplicación web para **crear, planificar, guardar y compartir rutas de bicicleta**.

> Guest-first · mapa real (MapLibre) · routing real (OpenRouteService) · Firebase · SEO útil

**Aislada** de `Aplicación de Control de Gastos Personales/` — no la modifica.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- MapLibre GL + OpenFreeMap tiles
- Firebase Auth / Firestore / Hosting (`pedalmap-79b3a`)
- OpenRouteService via `RoutingProvider`
- Zod · Vitest · Playwright

## Arquitectura

```
UI → Application Services → Route Engine Adapter → RoutingProvider → OpenRouteService
```

Ver `ARCHITECTURE.md` y `ROUTING_PROVIDER.md`.

## Instalación

```bash
cd pedalmap
npm install
cp .env.example .env.local
# Completa Firebase + VITE_ORS_API_KEY
npm run dev
```

URL local: `http://localhost:5173`

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_FIREBASE_*` | Config web Firebase (`pedalmap-79b3a`) |
| `VITE_ORS_API_KEY` | API key OpenRouteService (**obligatoria** para routing) |
| `VITE_MAP_STYLE_URL` | Style MapLibre (OpenFreeMap por defecto) |
| `VITE_GEOCODER_CONTACT_EMAIL` | Contacto Nominatim (recomendado) |

`.env` / `.env.local` están en `.gitignore`. Nunca subas claves.

## Firebase

Proyecto: **pedalmap-79b3a**

Activa en la consola:

1. Authentication → Email/Password + Google + (opcional) Anonymous
2. Firestore Database
3. Authorized domains para localhost / hosting

Desplegar rules:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use pedalmap-79b3a
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

Hosting:

```bash
npm run build
npx -y firebase-tools@latest deploy --only hosting
```

## OpenRouteService

1. Crea cuenta en https://openrouteservice.org/
2. Genera API key
3. Ponla en `.env.local` como `VITE_ORS_API_KEY=`

Sin esta clave el planificador funciona, pero el cálculo muestra un error claro (no inventa rutas).

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm test
npm run test:e2e
```

## Documentación

- `ARCHITECTURE.md`
- `ROUTING_PROVIDER.md`
- `COSTS.md`
- `SEO.md`
- `SECURITY.md`
- `ROADMAP.md`

## Criterio de calidad

¿Un ciclista puede buscar dos lugares, crear una ruta **real** y ver distancia, tiempo y desnivel?  
Ese es el listón del MVP.
