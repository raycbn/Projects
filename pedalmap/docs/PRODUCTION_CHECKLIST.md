# PRODUCTION_CHECKLIST — PedalMap

Estado actual (2026-08-10):

| Pieza | URL / estado |
|-------|----------------|
| App Hosting | ✅ https://pedalmap-79b3a.web.app |
| Mirror | ✅ https://pedalmap-79b3a.firebaseapp.com |
| Worker API | ✅ https://pedalmap-api.broken-dietician.workers.dev |
| Health | ✅ ORS + Stripe + Firestore admin |
| Google Auth (`web.app` OAuth redirect) | ✅ login Google OK en producción |
| Worker `APP_URL` → Hosting | ✅ |
| Legales | ✅ `/privacidad` `/cookies` `/terminos` + footer |
| Consentimiento analítica | ✅ banner + `pedalmap_consent` |
| Rate limit Worker | ✅ 40 req/min ORS · 20/min Stripe (Cache API) |
| Superficie por modalidad | ✅ scoring + multi-strategy ORS |
| Explorar vacío | ✅ demos Madrid/Sierra |
| Stripe | ⚠️ **test/sandbox** (no live hasta cobrar) |
| Dominio propio | ⏳ pendiente (DNS + Auth/CORS/APP_URL) |
| Rules/indexes deploy owner | ✅ publicadas por owner (2026-08-10) |

## Soft-launch gate

1. QA embudo: Google → ruta → paywall → Stripe test → `users.plan=premium` → portal
2. Owner deploy rules/indexes/storage si aún no:
```bash
cd pedalmap
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project pedalmap-79b3a
```
3. Hard-refresh Hosting tras cada release
4. Dominio custom cuando exista: Auth authorized domains + Worker `APP_URL`/`ALLOWED_ORIGINS` + OAuth client
5. Stripe **live** solo cuando quieras cobrar (`pk_live`/`sk_live`/webhook live)

## Rebuild + redeploy

```bash
cd pedalmap
./scripts/build-production.sh
npx firebase deploy --only hosting --project pedalmap-79b3a
cd workers/api && npm run deploy
```

## No hacer

- Blaze / Cloud Functions
- Stripe **live** sin querer cobrar
- Meter `ORS_API_KEY` / `sk_*` en Vite
