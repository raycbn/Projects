# Strava bridge (iGPSPORT / Garmin / Wahoo → Strava → PedalMap)

Flujo gratuito recomendado:

```
ciclocomputador (iGPSPORT, Garmin, Wahoo, …)
        │
        ▼
   App del fabricante  ──sync──►  STRAVA
                                      │
                                 OAuth 2 (Worker)
                                      │
                                      ▼
                                 PedalMap (/actividades)
                                      │
                                      ▼
                              Firestore `activities`
                         (GPS, altitud, FC, cadencia, W, velocidad)
```

## Por qué Strava

- Casi todos los GPS de bici sincronizan **gratis** con Strava.
- PedalMap no necesita SDK propietarios ni pagar APIs de cada marca.
- OAuth + lectura de actividades/streams está en el plan gratuito de Strava API (límites de rate apply).

## Setup (tú)

1. [Strava API Applications](https://www.strava.com/settings/api) → Create App  
   - **Authorization Callback Domain**: el host del Worker, p.ej. `pedalmap-api.broken-dietician.workers.dev`  
     (sin `https://`; Strava solo pide el dominio)  
   - El callback real que usa el código es:  
     `https://<worker>/strava/oauth/callback`

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

4. En la app: **Mis actividades** → **Conectar Strava** → **Ver salidas** → **Importar**.

## Endpoints Worker

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/strava/oauth/start` | Firebase Bearer |
| GET | `/strava/oauth/callback` | state HMAC (redirect Strava) |
| GET | `/strava/status` | Firebase Bearer |
| POST | `/strava/disconnect` | Firebase Bearer |
| GET | `/strava/activities` | Firebase Bearer |
| POST | `/strava/activities/:id/import` | Firebase Bearer |

Tokens **nunca** van al bundle Vite. Colección `stravaConnections` es read-only para el cliente.
