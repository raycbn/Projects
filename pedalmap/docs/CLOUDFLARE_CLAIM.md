# Cloudflare temporary Worker — RECLAMAR YA

Cuenta preview nueva. **Caduca en ~60 minutos si no la reclamas.**

1. Abre (cuenta Cloudflare free o créala):
   https://dash.cloudflare.com/claim-preview?claimToken=2sgQ-SU1hXkigQSnyouK8G7Kgpx0ezkAtpcTuYL_55A

2. Worker URL:
   https://pedalmap-api.broken-dietician.workers.dev

3. Stripe webhook (test) apuntando a:
   https://pedalmap-api.broken-dietician.workers.dev/stripe/webhook

4. Secrets ya subidos: ORS_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT

5. Tras reclamar, si `/health` muestra challenge, desactiva Bot Fight en el dashboard.
