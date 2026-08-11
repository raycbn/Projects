#!/usr/bin/env bash
# Build PedalMap for Firebase Hosting (Spark) + Cloudflare Worker API.
# Never embeds ORS / Stripe secret keys in the browser bundle.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

# Production overrides (Worker already claimed)
export VITE_PEDALMAP_API_URL="${VITE_PEDALMAP_API_URL:-https://pedalmap-api.broken-dietician.workers.dev}"
export VITE_ROUTING_PROXY_URL="${VITE_ROUTING_PROXY_URL:-$VITE_PEDALMAP_API_URL}"
export VITE_USE_ROUTING_PROXY=true
export VITE_STRIPE_ENABLED=true
export VITE_ALLOW_DIRECT_ORS=false
unset VITE_ORS_API_KEY VITE_ROUTING_API_KEY || true

if [[ -z "${VITE_STRIPE_PUBLISHABLE_KEY:-}" ]]; then
  echo "Missing VITE_STRIPE_PUBLISHABLE_KEY (pk_test_…)" >&2
  exit 1
fi

echo "Building with API=$VITE_PEDALMAP_API_URL stripe=$VITE_STRIPE_ENABLED"
npm run build

# Guardrails: secrets must not ship
if [[ -n "${ORS_API_KEY:-}" ]] && grep -R -F -q -- "$ORS_API_KEY" dist/; then
  echo "LEAK: ORS_API_KEY found in dist/" >&2
  exit 1
fi
if [[ -n "${STRIPE_SECRET_KEY:-}" ]] && grep -R -F -q -- "$STRIPE_SECRET_KEY" dist/; then
  echo "LEAK: STRIPE_SECRET_KEY found in dist/" >&2
  exit 1
fi
if ! grep -R -F -q -- 'pedalmap-api.broken-dietician.workers.dev' dist/; then
  echo "WARN: Worker URL not found in dist (check VITE_PEDALMAP_API_URL)" >&2
fi

# Personal inboxes must never ship in the client bundle.
if grep -R -E -q -- 'rayvf2002@gmail\.com|raymel\.vb@gmail\.com' dist/; then
  echo "LEAK: personal Gmail found in dist/" >&2
  exit 1
fi

echo "OK → dist/ ready for: npx firebase-tools deploy --only hosting --project pedalmap-79b3a"
