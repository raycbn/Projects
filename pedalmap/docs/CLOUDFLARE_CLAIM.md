# Cloudflare temporary Worker — RECLAMAR YA

Cuenta preview creada automáticamente. **Caduca en ~60 minutos si no la reclamas.**

1. Abre (ya logueado o crea cuenta free Cloudflare):
   https://dash.cloudflare.com/claim-preview?claimToken=lzc3MUJJ6kg1iPLwF5Gju1vV1kG5Y9SWCv8IF5QAUYo

2. Worker URL:
   https://pedalmap-api.rust-scarecrow.workers.dev

3. Stripe webhook (test) ya creado apuntando a:
   https://pedalmap-api.rust-scarecrow.workers.dev/stripe/webhook

4. Secrets ya subidos al Worker: ORS_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT

5. Tras reclamar, en el dashboard desactiva Bot Fight / challenge si `/health` muestra "Just a moment..." (cuentas preview a veces lo activan).

App preview: https://tsunami-rep-address-nikon.trycloudflare.com
