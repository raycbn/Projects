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

### E) Ajustes en `wrangler.toml` tras Hosting

- `APP_URL` = `https://pedalmap-79b3a.web.app`
- `ALLOWED_ORIGINS` = Hosting URLs
- Luego: `npx wrangler login && npm run deploy` en `workers/api`

Ver `docs/PRODUCTION_CHECKLIST.md`.

## F) Correos de marca (Google / Firebase / Resend / IONOS)

Guía completa: **`docs/EMAIL_SETUP.md`**.

Resumen:

1. **Google/Firebase no dejan elegir `soporte@`** hasta crear una cuenta Google con ese buzón e invitarla al proyecto.
2. Rellena nombre `PedalMap` + URLs `/privacidad` y `/terminos` en la pantalla OAuth.
3. **Resend** + registros DNS en **IONOS** (sin tocar MX) + `wrangler secret put RESEND_API_KEY`.

## No hagas

- Subir Firebase a **Blaze**
- Desplegar `functions/`
- Poner `sk_test` / ORS key en Vite
- Activar Stripe **live** todavía
