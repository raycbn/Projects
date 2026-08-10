# DEPLOY — PedalMap (0 € infra / Spark + Cloudflare Workers free)

## Principio

- Firebase **Spark** (sin Blaze, sin Cloud Functions de pago)
- API en **Cloudflare Workers** (free tier): proxy ORS + Stripe test
- Stripe en **test/sandbox** (sin cobros reales)
- La API key de ORS **solo** vive en el Worker (`ORS_API_KEY`), nunca en Vite

## Precios Premium (test)

| Plan | Producto | Price id | Importe |
|------|----------|----------|---------|
| Mensual | `prod_V2neg03A0x2bBl` | `price_1U2i2oDRDu30ohSLy0PIHXtJ` | 4,99 € |
| Anual | `prod_V2nhZxNNGpZOar` | `price_1U2i69DRDu30ohSLo5EoU9ed` | 39,99 € |

## 1. Worker local

```bash
cd pedalmap/workers/api
cp .dev.vars.example .dev.vars
# Rellena ORS_API_KEY, STRIPE_SECRET_KEY, (opcional) STRIPE_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT
npm install
npm run dev   # http://127.0.0.1:8787
```

App (`.env.local`):

```
VITE_PEDALMAP_API_URL=http://127.0.0.1:8787
VITE_USE_ROUTING_PROXY=true
VITE_STRIPE_ENABLED=true
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
# NO pongas VITE_ORS_API_KEY
```

## 2. Service account (gratis, Spark)

Para que el webhook escriba `users.plan` / `subscriptions/{uid}`:

1. Firebase Console → Project settings → Service accounts  
2. Generate new private key (JSON)  
3. `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT` (pega el JSON completo)  
4. Rol: Firebase Admin SDK o Cloud Datastore User es suficiente para Firestore REST

Sin este secret, el checkout test funciona pero **no** se actualiza Premium en Firestore.

## 3. Deploy Worker (Cloudflare free)

```bash
cd pedalmap/workers/api
npx wrangler login
npx wrangler secret put ORS_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
# Ajusta APP_URL / ALLOWED_ORIGINS en wrangler.toml
npm run deploy
```

URL típica: `https://pedalmap-api.<subdomain>.workers.dev`

## 4. Stripe Dashboard (manual)

1. Modo **Test**
2. Webhooks → Add endpoint → `https://pedalmap-api.<subdomain>.workers.dev/stripe/webhook`
3. Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copia el signing secret → `STRIPE_WEBHOOK_SECRET`
5. Customer Portal activado (test)

## 5. Firebase Hosting (Spark OK)

```bash
cd pedalmap
# build SIN VITE_ORS_API_KEY
VITE_PEDALMAP_API_URL=https://pedalmap-api.<subdomain>.workers.dev \
VITE_USE_ROUTING_PROXY=true \
VITE_STRIPE_ENABLED=true \
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... \
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

## 6. NO hacer

- Subir a Blaze
- `firebase deploy --only functions`
- Poner `VITE_ORS_API_KEY` / `sk_live` / `sk_test` en el frontend
- Activar cobros live hasta haber ingresos
