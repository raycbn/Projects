# MANUAL_SETUP — qué tienes que hacer tú (infra 0 €)

El código ya está listo. Esto es lo único **manual** que no puedo terminar desde aquí
sin tu cuenta de Cloudflare / Firebase console.

## Ya hecho en código

- Cloudflare Worker `workers/api` (ORS proxy + Stripe checkout/portal/webhook)
- Cliente usa Worker (sin Blaze / sin Functions)
- ORS key **no** se embebe en el frontend (`vite.config` la fuerza vacía)
- Precios test: 4,99 €/mes · 39,99 €/año (price ids en `wrangler.toml`)
- Firestore rules: el cliente no puede auto-subirse a Premium
- Docs: `docs/DEPLOY.md`
- Tests + build verificados

## Tú debes hacer (orden)

### A) Cloudflare (gratis)

1. Cuenta en Cloudflare (free)
2. En `pedalmap/workers/api`:
   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put ORS_API_KEY          # la misma key ORS que ya tienes
   npx wrangler secret put STRIPE_SECRET_KEY    # sk_test_…
   npx wrangler secret put STRIPE_WEBHOOK_SECRET # whsec_… (tras crear el webhook)
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT  # JSON entero (paso B)
   # GPS oficiales (paso D) — cuando tengas client ids:
   # npx wrangler secret put WAHOO_CLIENT_ID / WAHOO_CLIENT_SECRET / WAHOO_WEBHOOK_TOKEN
   # npx wrangler secret put IGPSPORT_CLIENT_ID / IGPSPORT_CLIENT_SECRET / IGPSPORT_WEBHOOK_TOKEN
   # npx wrangler secret put GARMIN_CLIENT_ID / GARMIN_CLIENT_SECRET / GARMIN_WEBHOOK_TOKEN
   npm run deploy
   ```
3. Copia la URL `https://pedalmap-api.<subdomain>.workers.dev`

### B) Firebase service account (gratis, Spark)

1. Firebase Console → ⚙️ Project settings → Service accounts  
2. **Generate new private key** (JSON)  
3. Ese JSON → secret `FIREBASE_SERVICE_ACCOUNT` del Worker  
   (sin esto el checkout test funciona, pero **no** se escribe `users.plan`)

### C) Stripe Dashboard (modo Test)

1. Developers → Webhooks → Add endpoint  
   URL: `https://pedalmap-api.<subdomain>.workers.dev/stripe/webhook`  
2. Eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Signing secret → `STRIPE_WEBHOOK_SECRET`
4. Settings → Billing → Customer portal → activar (test)

### D) Frontend env de producción / preview

```
VITE_PEDALMAP_API_URL=https://pedalmap-api.broken-dietician.workers.dev
VITE_USE_ROUTING_PROXY=true
VITE_STRIPE_ENABLED=true
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…
# NO VITE_ORS_API_KEY
```

Rebuild + hosting (ya desplegado una vez → https://pedalmap-79b3a.web.app):
```bash
./scripts/build-production.sh
npx firebase-tools deploy --only hosting --project pedalmap-79b3a
# rules/indexes/storage con tu login owner:
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project pedalmap-79b3a
```

### D) GPS oficiales (auto-upload iGPSPORT / Wahoo / Garmin)

1. Sigue `docs/GPS_OFFICIAL_SYNC.md` (emails de solicitud + secrets).  
2. Wahoo suele ser el más rápido (sandbox self-serve).  
3. iGPSPORT: email a `global@igpsport.com` con redirect + callback del Worker.  
4. Garmin: Connect Developer Program.  
5. `firebase deploy --only firestore:rules` tras añadir `gpsConnections`.  
6. Strava queda opcional/legacy (`docs/STRAVA_BRIDGE.md`) — no se muestra en la UI.

### E) Ajustes en `wrangler.toml` tras Hosting / dominio

- `APP_URL` = `https://pedalmap.es` (ya en código)
- `ALLOWED_ORIGINS` incluye `pedalmap.es` + `www` + Hosting Firebase
- Dominio IONOS: `docs/DOMAIN_PEDALMAP_ES.md`
- Luego: `npm run deploy` en `workers/api`

Ver `docs/PRODUCTION_CHECKLIST.md`.

## No hagas

- Subir Firebase a **Blaze**
- Desplegar `functions/`
- Poner `sk_test` / ORS key en Vite
- Activar Stripe **live** todavía
