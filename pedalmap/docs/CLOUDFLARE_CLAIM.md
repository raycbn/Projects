# Cloudflare Worker — reclamado

Estado: **reclamado y operativo**.

- Worker: https://pedalmap-api.broken-dietician.workers.dev
- Health: `GET /health` → ok (ORS + Stripe + Firestore admin)
- Stripe webhook test: `https://pedalmap-api.broken-dietician.workers.dev/stripe/webhook`

Cliente:
```
VITE_PEDALMAP_API_URL=https://pedalmap-api.broken-dietician.workers.dev
VITE_USE_ROUTING_PROXY=true
VITE_STRIPE_ENABLED=true
```

Para futuros deploys desde tu máquina:
```bash
cd pedalmap/workers/api
npx wrangler login
npm run deploy
```
