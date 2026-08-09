# PedalMap

Aplicación web para **crear, planificar, guardar y compartir rutas de bicicleta**.

> Guest-first · MapLibre · OpenRouteService (HeiGIT) · Firebase `pedalmap-79b3a`

Aislada de `Aplicación de Control de Gastos Personales/` — no la modifica.

## Stack

- React + TypeScript + Vite + Tailwind
- MapLibre GL + OpenFreeMap tiles
- Firebase Auth / Firestore / Hosting
- OpenRouteService via `RoutingProvider` → `https://api.heigit.org/openrouteservice`
- Geocoding: Nominatim + fallback Photon
- Vitest + Playwright

## Arranque

```bash
cd pedalmap
npm install
# VITE_* deben estar en el entorno / secrets / .env.local (gitignored)
npm run dev
```

URL local: `http://localhost:5173`

## Variables

| Variable | Uso |
|----------|-----|
| `VITE_FIREBASE_*` | Proyecto `pedalmap-79b3a` |
| `VITE_ORS_API_KEY` | OpenRouteService (obligatoria para routing) |
| `VITE_MAP_STYLE_URL` | Style MapLibre |

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm test
npm run test:e2e
node scripts/validate-mvp.mjs   # geocode + ORS si hay key
```

## Limitaciones conocidas (validación)

- `api.openrouteservice.org` está **deprecado**; usamos HeiGIT.
- Nominatim puede devolver 403 desde IPs de datacenter → fallback Photon.
- Google Auth requiere el dominio del preview en Authorized domains (ya añadido el túnel Cloudflare en la validación).
- `VITE_ORS_API_KEY` debe estar inyectada en el proceso del agent/build; sin ella el planner muestra error claro (no inventa rutas).

## Docs

`ARCHITECTURE.md` · `ROUTING_PROVIDER.md` · `COSTS.md` · `SECURITY.md` · `ROADMAP.md` · `SEO.md`
