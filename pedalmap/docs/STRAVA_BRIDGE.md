# GPS cloud bridge (iGPSPORT / Garmin / … → nube → PedalMap)

Flujo gratuito mientras las APIs oficiales (iGPSPORT, Garmin, …) están bloqueadas o en espera:

```
ciclocomputador (iGPSPORT, Garmin, Magene, Bryton, …)
        │
        ▼
   App del fabricante  ──sync──►  nube compatible (Strava API)
                                      │
                                 OAuth 2 (Worker)  ← hop breve
                                      │
                                      ▼
                                 PedalMap (/actividades)
                                      │
                                      ▼
                              Firestore `activities`
                         (GPS, altitud, FC, cadencia, W, velocidad)
```

## Principio de producto

- **Destino = PedalMap.** El usuario no “se va a vivir a Strava”.
- En la UI hablamos de **sincronización → PedalMap**, no de “usar Strava”.
- Strava es solo el **transporte** OAuth/API (casi todos los GPS ya suben ahí gratis).
- Tras autorizar, el Worker redirige siempre a `/actividades?strava=connected` y la app **importa sola**.

## Setup (tú)

1. [Strava API Applications](https://www.strava.com/settings/api) → Create App  
   - **Authorization Callback Domain**: el host del Worker, p.ej. `pedalmap-api.broken-dietician.workers.dev`  
     (sin `https://`; Strava solo pide el dominio)  
   - Callback real: `https://<worker>/strava/oauth/callback`

2. En `pedalmap/workers/api`:
   ```bash
   npx wrangler secret put STRAVA_CLIENT_ID
   npx wrangler secret put STRAVA_CLIENT_SECRET
   npm run deploy
   ```
   Hace falta también `FIREBASE_SERVICE_ACCOUNT` (ya usado por Stripe) para guardar tokens en `stravaConnections/{uid}`.

3. Publica rules + índice (owner):
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project pedalmap-79b3a
   ```

4. En la app: **Mis actividades** → **iGPSPORT, Garmin y otros GPS** → **Activar sincronización → PedalMap** → vuelve e importa.

## Endpoints Worker

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/strava/oauth/start` | Firebase Bearer |
| GET | `/strava/oauth/callback` | state HMAC (redirect) |
| GET | `/strava/status` | Firebase Bearer |
| POST | `/strava/disconnect` | Firebase Bearer |
| GET | `/strava/activities` | Firebase Bearer |
| POST | `/strava/activities/:id/import` | Firebase Bearer |

Tokens **nunca** van al bundle Vite. Colección `stravaConnections` es read-only para el cliente.
