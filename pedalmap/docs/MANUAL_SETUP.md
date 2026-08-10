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
VITE_PEDALMAP_API_URL=https://pedalmap-api.<subdomain>.workers.dev
VITE_USE_ROUTING_PROXY=true
VITE_STRIPE_ENABLED=true
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…
# NO VITE_ORS_API_KEY
```

Rebuild + hosting:
```bash
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

### E) Ajustes en `wrangler.toml` tras tener dominio

- `APP_URL` = URL real de la app (success/cancel Checkout)
- `ALLOWED_ORIGINS` = orígenes permitidos CORS

## No hagas

- Subir Firebase a **Blaze**
- Desplegar `functions/`
- Poner `sk_test` / ORS key en Vite
- Activar Stripe **live** todavía
