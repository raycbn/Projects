# DEPLOY — PedalMap (producción mínima)

## 1. Firebase Blaze

El proyecto `pedalmap-79b3a` necesita plan **Blaze** para Cloud Functions + Stripe webhooks.

## 2. Secrets / params (Functions)

```bash
firebase functions:secrets:set ORS_API_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:params:set STRIPE_PRICE_MONTHLY=price_xxx
firebase functions:params:set STRIPE_PRICE_YEARLY=price_yyy
firebase functions:params:set APP_URL=https://tu-dominio.com
```

## 3. Deploy

```bash
cd pedalmap
npm run build
cd functions && npm ci && npm run build && cd ..
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting,storage
```

`orsProxy` URL típica:

`https://europe-west1-pedalmap-79b3a.cloudfunctions.net/orsProxy`

## 4. Cliente producción (`.env.production` / Hosting env)

```
VITE_USE_ROUTING_PROXY=true
VITE_ROUTING_PROXY_URL=https://europe-west1-pedalmap-79b3a.cloudfunctions.net/orsProxy
VITE_ORS_API_KEY=   # vacío en prod si usas proxy
VITE_STRIPE_ENABLED=true
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_...
VITE_FIREBASE_FUNCTIONS_REGION=europe-west1
```

## 5. Stripe Dashboard

1. Productos mensual/anual → copiar price ids
2. Webhook → `.../stripeWebhook` eventos:
   - `checkout.session.completed`
   - `customer.subscription.created|updated|deleted`
3. Customer Portal activado

## 6. Auth / dominio

- Dominios autorizados en Firebase Auth (Hosting + custom domain)
- `APP_URL` = origen real del Checkout success/cancel

## 7. Smoke checklist

- [ ] Crear ruta (5 bike types) + desnivel sano
- [ ] Multi-filtros: Free máx 2, Premium ilimitado
- [ ] Guardar ruta + contador `usage` (Functions)
- [ ] Explorar: rutas públicas / seguir / segmento / reto / ranking
- [ ] Actividad GPS
- [ ] Checkout test Stripe → `users.plan=premium`
