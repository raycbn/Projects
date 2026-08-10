# PedalMap API — Cloudflare Workers (FREE tier)
#
# Replaces Firebase Cloud Functions so Firebase can stay on Spark (0 €).
#
# Endpoints
#   GET  /health
#   POST /v2/directions/{cycling-*}/geojson   → ORS proxy (key never in browser)
#   POST /stripe/checkout                     → Checkout Session (Firebase ID token)
#   POST /stripe/portal                       → Customer Portal
#   POST /stripe/webhook                      → Stripe → Firestore plan update
#
# Local
#   1. Copy .dev.vars.example → .dev.vars and fill secrets
#   2. npm run dev
#
# Deploy (you run this once Cloudflare account exists — free)
#   npx wrangler login
#   npx wrangler secret put ORS_API_KEY
#   npx wrangler secret put STRIPE_SECRET_KEY
#   npx wrangler secret put STRIPE_WEBHOOK_SECRET
#   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
#   npm run deploy
#
# Stripe Dashboard webhook URL:
#   https://<worker>.workers.dev/stripe/webhook
#   events: checkout.session.completed, customer.subscription.*
