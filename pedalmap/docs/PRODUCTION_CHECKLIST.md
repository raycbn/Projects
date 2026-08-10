# PRODUCTION_CHECKLIST — PedalMap

Estado actual (2026-08-10):

| Pieza | URL / estado |
|-------|----------------|
| App Hosting | ✅ https://pedalmap-79b3a.web.app |
| Mirror | ✅ https://pedalmap-79b3a.firebaseapp.com |
| Worker API | ✅ https://pedalmap-api.broken-dietician.workers.dev |
| Health | ✅ ORS + Stripe + Firestore admin |
| Firestore rules/indexes deploy | ⏳ necesita login Firebase (owner) |
| Storage rules deploy | ⏳ necesita login Firebase (owner) |
| Worker `APP_URL` → Hosting | ⏳ necesita `wrangler login` + redeploy |

## 1) Ya hecho

- Build producción **sin** ORS key en el bundle
- Cliente apunta al Worker reclamado
- `firebase deploy --only hosting` → live

## 2) Tú: actualizar Worker (Stripe redirects)

El checkout Stripe usa `APP_URL` del Worker para `success` / `cancel` / portal.
Hay que apuntarlo a Hosting (ahora mismo puede seguir un túnel temporal).

```bash
cd pedalmap/workers/api
npx wrangler login
# wrangler.toml ya debe tener:
#   APP_URL = "https://pedalmap-79b3a.web.app"
#   ALLOWED_ORIGINS = "https://pedalmap-79b3a.web.app,https://pedalmap-79b3a.firebaseapp.com"
npm run deploy
```

## 3) Tú: rules / indexes / storage (opcional si ya estaban)

La service account Admin SDK puede subir Hosting, pero **no** Service Usage
(403 al desplegar rules). Desde tu cuenta owner:

```bash
cd pedalmap
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project pedalmap-79b3a
```

## 4) QA en producción (test)

1. Abrir https://pedalmap-79b3a.web.app
2. Login (en **móvil** Google usa redirección, no popup)
3. Planificar ruta A→B (proxy ORS)
4. Free: 3 filtros → paywall
5. `/premium` → Stripe test (`4242…`)
6. Tras pagar: Firestore `users/{uid}.plan` = `premium`
7. Portal de cliente desde `/premium`

### Google Auth

- Dominios autorizados OK: `pedalmap-79b3a.web.app`, `firebaseapp.com`, `localhost`
- Móvil / touch: `signInWithRedirect` (evita `auth/popup-closed-by-user` por COOP)
- Desktop: popup; si el navegador bloquea → redirect

## 5) Rebuild + redeploy Hosting

```bash
cd pedalmap
./scripts/build-production.sh
npx firebase deploy --only hosting --project pedalmap-79b3a
# o con SA:
# GOOGLE_APPLICATION_CREDENTIALS=workers/api/.secrets/firebase-sa.json \
#   npx firebase-tools deploy --only hosting --project pedalmap-79b3a
```

## No hacer

- Blaze / Cloud Functions
- Stripe **live**
- Meter `ORS_API_KEY` / `sk_*` en Vite
