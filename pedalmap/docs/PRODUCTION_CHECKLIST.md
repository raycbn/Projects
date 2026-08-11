# Production checklist — PedalMap

| Recurso | Estado |
|---------|--------|
| App canónica | ✅ https://pedalmap.es |
| www | ✅ https://www.pedalmap.es (mismo Hosting) |
| Mirror Firebase | ✅ https://pedalmap-79b3a.web.app (respaldo) |
| Worker API | ✅ https://pedalmap-api.broken-dietician.workers.dev |
| Worker `APP_URL` | ✅ `https://pedalmap.es` |
| CORS `ALLOWED_ORIGINS` | ✅ apex + www + legacy + localhost |
| Sitemap / robots | ✅ `pedalmap.es` (ver `docs/DOMAIN_AUDIT.md`) |
| Auth authorized domains | ✅ incluye `pedalmap.es` / `www` |
| Wahoo secrets | ✅ CLIENT_ID / SECRET / WEBHOOK_TOKEN |
| iGPSPORT / Garmin | ⏳ pendiente aprobación API |
| Dominio setup | ✅ `docs/DOMAIN_PEDALMAP_ES.md` |

## Notas

1. Redeploy Worker tras cambiar `wrangler.toml` vars.
2. Redeploy Hosting tras sitemap/robots/logo.
3. Login Google en dominio custom: ver checklist en `docs/DOMAIN_AUDIT.md`.
4. OAuth client GPS: website `https://pedalmap.es`; callbacks siguen en el Worker.
