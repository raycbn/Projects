# MONETIZATION — PedalMap

## Modelo

**Freemium + suscripción** (Stripe **test/sandbox** mientras no haya ingresos).

### Free
- Límites de creación/guardado
- Hasta **2** filtros activos a la vez

### Premium — 4,99 €/mes · 39,99 €/año
- Ilimitado (rutas, filtros, GPX, circulares)

Price ids (test):
- Mensual `price_1U2i2oDRDu30ohSLy0PIHXtJ` (prod `prod_V2neg03A0x2bBl`)
- Anual `price_1U2i69DRDu30ohSLo5EoU9ed` (prod `prod_V2nhZxNNGpZOar`)

## Infra 0 €

- Firebase **Spark** (Auth + Firestore + Hosting)
- **Cloudflare Workers** free: ORS proxy + Stripe checkout/webhook/portal
- **No** Blaze / **No** Cloud Functions de pago

## Seguridad

- `sk_test_*`, `ORS_API_KEY`, service account → solo Worker secrets
- `pk_test_*` → Vite (`VITE_STRIPE_PUBLISHABLE_KEY`)
- Clientes **no** pueden autoasignarse `plan: premium` (Firestore rules)
- Webhook Worker escribe `subscriptions/{uid}` + `users.plan` con service account

## Paywall

`PremiumCard` + `/premium` (mensual/anual/portal)
