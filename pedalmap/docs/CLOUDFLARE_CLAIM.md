# Cloudflare Worker — reclamado

Estado: **reclamado y operativo**.

- Worker: https://pedalmap-api.broken-dietician.workers.dev
- Health: `GET /health` → ok (ORS + Stripe + Firestore admin)
- Stripe webhook test: `https://pedalmap-api.broken-dietician.workers.dev/stripe/webhook`
- App Hosting: https://pedalmap-79b3a.web.app

Cliente:
```
VITE_PEDALMAP_API_URL=https://pedalmap-api.broken-dietician.workers.dev
VITE_USE_ROUTING_PROXY=true
VITE_STRIPE_ENABLED=true
```

Pendiente en tu máquina (Stripe success/cancel → Hosting):
```bash
cd pedalmap/workers/api
npx wrangler login
# APP_URL / ALLOWED_ORIGINS ya están en wrangler.toml → Hosting
npm run deploy
```

Checklist completo: `docs/PRODUCTION_CHECKLIST.md`
