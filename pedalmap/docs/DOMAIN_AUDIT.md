# Auditoría dominio `pedalmap.es` (2026-08-11)

## Objetivo

Que **toda** la superficie de producto trate `https://pedalmap.es` como origen canónico (SEO, shares, Auth, Stripe redirects, CORS).

## Hallazgos corregidos en código

| Área | Antes | Después |
|------|--------|---------|
| `public/sitemap.xml` | `pedalmap-79b3a.web.app` | `pedalmap.es` |
| `public/robots.txt` | `https://pedalmap.app/sitemap.xml` (dominio erróneo) | `https://pedalmap.es/sitemap.xml` |
| `usePageMeta` | `window.location.origin` (www/legacy) | `publicSiteUrl()` → apex |
| `firebase` authDomain | solo `*.web.app` / `*.firebaseapp.com` | también `pedalmap.es` / `www` |
| Share card / enlaces públicos | host actual o `pedalmap.app` | `pedalmap.es` |
| Worker `APP_URL` / CORS | ya `pedalmap.es` | sin cambio |
| SW cache | v3 + favicon.svg | v4 + logos de marca |

## Correcto a propósito (no migrar)

- API Worker: `https://pedalmap-api.broken-dietician.workers.dev` (OAuth/webhooks GPS y Stripe).
- Hosting legacy `*.web.app` en `ALLOWED_ORIGINS` como respaldo.
- Callbacks Wahoo/iGPSPORT/Garmin en el Worker (no en el dominio de la web).

## Checklist manual (tú)

1. **Firebase Auth → Authorized domains**: `pedalmap.es`, `www.pedalmap.es` ✅ (ya lo hiciste).
2. **Google Cloud OAuth** (si login Google falla en el dominio nuevo):  
   En el cliente OAuth de Firebase, asegúrate de que existen redirect URIs:
   - `https://pedalmap.es/__/auth/handler`
   - `https://www.pedalmap.es/__/auth/handler`  
   (Firebase suele gestionarlos al añadir el dominio autorizado; verifica si Google login rompe).
3. **Stripe** Checkout success/cancel usan `APP_URL` del Worker → ya `https://pedalmap.es/premium?...`.
4. Opcional: en Firebase Hosting, redirigir `www` → apex (o al revés) para una sola URL canónica.

## Verificación rápida

```bash
curl -sI https://pedalmap.es | head -5
curl -s https://pedalmap.es/robots.txt
curl -s https://pedalmap.es/sitemap.xml | head -5
curl -sI -X OPTIONS https://pedalmap-api.broken-dietician.workers.dev/health \
  -H 'Origin: https://pedalmap.es' -H 'Access-Control-Request-Method: GET'
```
