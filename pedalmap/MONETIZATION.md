# MONETIZATION — PedalMap

## Modelo

**Freemium + suscripción** (mensual/anual vía Stripe — Fase 4).

### Free

- Crear rutas con límite mensual
- Guardar número limitado
- Compartir básico
- Ver mapa, stats, elevación
- Probar sin registro

### Premium

- Rutas ilimitadas
- Exportación GPX
- Filtros avanzados
- Rutas circulares avanzadas
- Estadísticas avanzadas
- Base para navegación / offline futuros

Límites en código: `FREE_LIMITS` / `PREMIUM_LIMITS` + `EntitlementService` (cliente) +
`onRouteCreated` (Functions, contadores server-side).

## Paywall

UI: `PremiumCard` + `/premium`. El cliente no puede autoasignarse `plan: premium`
(Firestore rules).

## Stripe (Fase 4)

Cliente:

```
VITE_STRIPE_ENABLED=true
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
```

Functions secrets / params:

```
ORS_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_MONTHLY
STRIPE_PRICE_YEARLY
APP_URL
```

Flujo:

1. `createCheckoutSession` (callable) → Stripe Checkout
2. `stripeWebhook` → `subscriptions/{uid}` + `users.plan = premium`
3. `createCustomerPortalSession` → gestionar / cancelar
4. `orsProxy` → routing sin exponer la API key en el navegador

## Afiliación (futuro)

Colección prevista `affiliateLinks` — no se añaden enlaces falsos todavía.

## Analytics de conversión

Eventos: `premium_clicked`, `signup_started`, `signup_completed`, `route_saved`,
`gpx_exported`, `activity_started`, `activity_finished`.
