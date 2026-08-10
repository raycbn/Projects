# Dominio `pedalmap.es` (IONOS → Firebase Hosting)

## Ya hecho en código / Worker

- `APP_URL` = `https://pedalmap.es`
- `ALLOWED_ORIGINS` incluye `https://pedalmap.es` y `https://www.pedalmap.es`
- Redirects OAuth GPS vuelven a `https://pedalmap.es/actividades`

El hosting en `pedalmap-79b3a.web.app` sigue válido como respaldo.

## Tú en Firebase (5 min)

1. [Firebase Console → Hosting](https://console.firebase.google.com/project/pedalmap-79b3a/hosting)  
2. **Add custom domain** → `pedalmap.es`  
3. Añade también `www.pedalmap.es` (redirect a apex o al revés, como prefieras)  
4. Firebase te muestra registros DNS (A / TXT / a veces CNAME). **Cópialos tal cual.**

5. Authentication → Settings → **Authorized domains** → añade:
   - `pedalmap.es`
   - `www.pedalmap.es`

## Tú en IONOS DNS

Panel IONOS → Dominios & SSL → `pedalmap.es` → DNS.

Pega **exactamente** lo que Firebase te pida. Suele ser algo así (valores de ejemplo — usa los de Firebase):

| Tipo | Nombre / Host | Valor |
|------|---------------|--------|
| TXT | `@` o el host que diga Firebase | token de verificación |
| A | `@` | IPs de Firebase Hosting |
| CNAME | `www` | `pedalmap-79b3a.web.app` (o lo que indique Firebase) |

Quita registros A/AAAA/CNAME viejos de parking de IONOS que choquen con `@` o `www`.

Espera la propagación (minutos a unas horas). Firebase marcará el dominio como **Connected** + SSL.

## APIs GPS (cuando el dominio esté verde)

En solicitudes a fabricantes usa:

- **Official website:** `https://pedalmap.es`
- OAuth callbacks del Worker (siguen en workers.dev, no hace falta dominio ahí):
  - `https://pedalmap-api.broken-dietician.workers.dev/gps/igpsport/oauth/callback`
  - idem garmin/wahoo
- Webhooks: `…/gps/:provider/webhook`

## Comprobar

```bash
curl -I https://pedalmap.es
# → 200 / Firebase

# CORS Worker
curl -I -X OPTIONS https://pedalmap-api.broken-dietician.workers.dev/health \
  -H 'Origin: https://pedalmap.es' -H 'Access-Control-Request-Method: GET'
```
