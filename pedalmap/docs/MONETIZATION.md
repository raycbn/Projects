# MONETIZATION — PedalMap

## Modelo

**Freemium + suscripción** (mensual/anual vía Stripe en Fase 4).

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

Límites en código: `FREE_LIMITS` / `PREMIUM_LIMITS` + `EntitlementService`.

## Paywall

UI: `PremiumCard` — clara, sin engaños. Explica que Stripe aún no cobra.

## Stripe (preparado, no activo)

Variables futuras:

```
VITE_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Flujo previsto:

1. Checkout Session desde Cloud Function
2. Webhook → actualizar `subscriptions/{uid}` + `users.plan = premium`
3. Firestore rules: el cliente **no** puede autoasignarse `premium`

## Afiliación (futuro)

Colección prevista `affiliateLinks`:

```
{ id, category, label, url, merchant, active, priority }
```

Categorías: bicicletas, GPS, ropa, seguros, alojamiento, nutrición, talleres.

**No** se añaden enlaces falsos en Fase 1.

## Analytics de conversión

Eventos: `premium_clicked`, `signup_started`, `signup_completed`, `route_saved`, `gpx_exported`.
