# DEPLOY — PedalMap (producción mínima)

Ver `docs/DEPLOY.md` (misma guía).

## Resumen rápido

1. Blaze en Firebase  
2. Secrets ORS + Stripe + APP_URL  
3. `firebase deploy --only firestore,functions,hosting,storage`  
4. Cliente: `VITE_USE_ROUTING_PROXY=true` + `VITE_STRIPE_ENABLED=true`  
5. Webhook Stripe → `stripeWebhook`
