# MONETIZATION — PedalMap

## Modelo

**Freemium + suscripción** (Stripe **Live** prices wired; confirm `sk_live` + live webhook before charging).

### Free
- Límites de creación/guardado
- Hasta **2** filtros activos a la vez
- Soft trials: 1 GPX/semana · 1 Objetivo/mes

### Premium — 4,99 €/mes · 39,99 €/año
- Ilimitado (rutas, filtros, GPX, circulares, avisos)
- Anual: 7 días de prueba

### Pack Grupeta — 14,99 €/mes · 119,99 €/año (4 plazas)
- Tú + 3 emails Premium; asignación **después** del pago
- Anual: 7 días de prueba · mensual sin trial
- Ver `docs/GRUPETA_PACK.md`

Price ids (**Live**):
- Mensual `price_1U3Jz2D9NwIvrlQEilHY4AXf` (prod `prod_V3Qq3Wjtf6JDeL`)
- Anual `price_1U3K1LD9NwIvrlQEIIFS5oTG` (prod `prod_V3QtIN4qXG6R2R`)
- Grupeta mensual `price_1U3bpPD9NwIvrlQEzgfsjSvB` (14,99 €)
- Grupeta anual `price_1U3bmtD9NwIvrlQEJc1FhkLw` (119,99 €)

Legacy test prices (retirados del Worker):
- Mensual `price_1U2i2oDRDu30ohSLy0PIHXtJ`
- Anual `price_1U2i69DRDu30ohSLo5EoU9ed`

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
