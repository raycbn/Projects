# PRODUCTION_CHECKLIST — PedalMap

Estado actual (2026-08-10):

| Pieza | URL / estado |
|-------|----------------|
| App Hosting | ✅ https://pedalmap-79b3a.web.app |
| Mirror | ✅ https://pedalmap-79b3a.firebaseapp.com |
| Worker API | ✅ https://pedalmap-api.broken-dietician.workers.dev |
| Health | ✅ ORS + Stripe + Firestore admin |
| Google Auth (`web.app` OAuth redirect) | ✅ login Google OK en producción |
| Worker `APP_URL` → Hosting | ✅ redeployed (`APP_URL` + Origin Stripe returns) |

## 1) Ya hecho

- Build producción **sin** ORS key en el bundle
- Cliente apunta al Worker reclamado
- `firebase deploy --only hosting` → live

## 2) Worker (Stripe redirects) — hecho

`APP_URL=https://pedalmap-79b3a.web.app` y CORS Hosting desplegados.
Checkout/portal usan Origin allowlisted si viene del navegador.

Para redeploy futuro:
```bash
cd pedalmap/workers/api
npx wrangler login   # o sesión ya activa
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

- Dominios Auth OK: `pedalmap-79b3a.web.app`, `firebaseapp.com`, `localhost`
- App usa `authDomain` = hostname Hosting (`*.web.app`) para redirect first-party
- **Obligatorio en Google Cloud OAuth client** (Web client de Firebase):
  - Origin: `https://pedalmap-79b3a.web.app`
  - Redirect: `https://pedalmap-79b3a.web.app/__/auth/handler`
  - Consola: APIs & Services → Credentials → OAuth 2.0 Client IDs
- Móvil: `signInWithRedirect`; desktop: popup (fallback redirect si bloquea)

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
