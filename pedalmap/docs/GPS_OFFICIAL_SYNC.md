# Sync oficial multi-GPS (auto-upload)

Objetivo: cuando el ciclista termina una salida en **iGPSPORT / Wahoo / Garmin**, la actividad llega sola a PedalMap (webhook → Worker → Firestore), con análisis Free enriquecido. **Sin Strava en la UX.**

```
Ciclocomputador → App del fabricante → Cloud oficial
                                      │  webhook / OAuth
                                      ▼
                              PedalMap Worker `/gps/:provider/*`
                                      │
                                      ▼
                              Firestore `activities`
```

## Estado por marca

| Marca | API oficial | Coste tipico | Auto-upload | Estado en PedalMap |
|-------|-------------|--------------|-------------|--------------------|
| **Wahoo** | [Cloud API](https://cloud-api.wahooligan.com/) OAuth2 + `workout_summary` webhooks | Sandbox gratis; Production con review | Sí (`offline_data`) | **Código listo** — falta crear app + secrets |
| **iGPSPORT** | OpenAPI partner (`global@igpsport.com`) + `callback_url` | Gratis tras aprobación | Sí (callback) | **Scaffold + webhook** — falta aprobación |
| **Garmin** | [Connect Developer Program](https://developerportal.garmin.com/) OAuth2 PKCE + Activity Export | Gratis para partners aprobados* | Sí (webhooks) | **Scaffold OAuth/webhook** — falta aprobación |
| Magene / Bryton / Coros | Sin API self-serve pública estable | — | — | Fuera de alcance hasta partner |

\*Garmin: uso comercial puede requerir licencia según caso; el programa base es gratuito tras review.

## Endpoints Worker

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/gps/status` | Firebase Bearer |
| POST | `/gps/:provider/oauth/start` | Firebase Bearer |
| GET | `/gps/:provider/oauth/callback` | state HMAC (redirect) |
| POST | `/gps/:provider/disconnect` | Firebase Bearer |
| POST | `/gps/:provider/sync` | Firebase Bearer (pull) |
| POST | `/gps/:provider/webhook` | token fabricante |

Providers: `wahoo` \| `igpsport` \| `garmin`

Callback URLs a registrar en cada portal:

```
https://pedalmap-api.broken-dietician.workers.dev/gps/wahoo/oauth/callback
https://pedalmap-api.broken-dietician.workers.dev/gps/igpsport/oauth/callback
https://pedalmap-api.broken-dietician.workers.dev/gps/garmin/oauth/callback
```

Webhooks:

```
https://pedalmap-api.broken-dietician.workers.dev/gps/wahoo/webhook
https://pedalmap-api.broken-dietician.workers.dev/gps/igpsport/webhook
https://pedalmap-api.broken-dietician.workers.dev/gps/garmin/webhook
```

## Secrets (tú)

```bash
cd pedalmap/workers/api

# Wahoo — https://developers.wahooligan.com
npx wrangler secret put WAHOO_CLIENT_ID
npx wrangler secret put WAHOO_CLIENT_SECRET
npx wrangler secret put WAHOO_WEBHOOK_TOKEN   # el que configures en el portal

# iGPSPORT — tras aprobación OpenAPI
npx wrangler secret put IGPSPORT_CLIENT_ID
npx wrangler secret put IGPSPORT_CLIENT_SECRET
npx wrangler secret put IGPSPORT_WEBHOOK_TOKEN

# Garmin — tras Developer Program
npx wrangler secret put GARMIN_CLIENT_ID
npx wrangler secret put GARMIN_CLIENT_SECRET
npx wrangler secret put GARMIN_WEBHOOK_TOKEN

npm run deploy
firebase deploy --only firestore:rules --project pedalmap-79b3a
```

## Email iGPSPORT (copiar/pegar)

**To:** global@igpsport.com  
**Subject:** PedalMap OpenAPI developer application

```
Application Name: PedalMap
App Introduction: Cycling route planner and ride logger. We sync finished rides from iGPSPORT into PedalMap so athletes get automatic activity upload and free training analytics (moving time, estimated power, VAM, km splits).
redirect_url: https://pedalmap-api.broken-dietician.workers.dev/gps/igpsport/oauth/callback
callback_url: https://pedalmap-api.broken-dietician.workers.dev/gps/igpsport/webhook
Company name: [TU RAZÓN SOCIAL / NOMBRE]
Official website: https://pedalmap.es
Application Logo: attach PNG 120x120 from `public/brand/logo-120.png` (or download https://pedalmap.es/brand/logo-120.png once deployed)
```

## Wahoo (checklist)

1. Crear cuenta en https://developers.wahooligan.com  
2. App Sandbox → scopes `user_read`, `workouts_read`, `offline_data`  
3. redirect_uri = callback OAuth arriba  
4. webhook_url = webhook arriba + webhook_token  
5. Secrets + deploy  
6. Pedir Production review cuando Sandbox esté estable  
7. En la ficha de la app, website / descripción → `https://pedalmap.es` 

## Garmin (checklist)

1. Aplicar a Garmin Connect Developer Program  
2. Solicitar Activity Export + user permission webhooks  
3. OAuth redirect = callback Garmin arriba  
4. Secrets + deploy  

## También en PedalMap (ya vivo)

- Grabación nativa `/actividad` → auto-guarda + análisis Free (`docs/NATIVE_ACTIVITY.md`)
- UI `/actividades` → “Conectar tu GPS” (sin Strava)

## Siguiente mejora técnica

- Parsear FIT de Wahoo/Garmin para track GPS completo (hoy importamos summary rico; mapa vacío hasta FIT)
- Completar pull sync iGPSPORT/Garmin cuando den contratos de API
