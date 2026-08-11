# Google login en `pedalmap.es`

## Problema

En móvil, "Continuar con Google" vuelve a `/login` sin sesión.

Causa: la app vive en `pedalmap.es` pero `authDomain` es `*.web.app` (el redirect
URI de Google OAuth aún no incluye `https://pedalmap.es/__/auth/handler`).
Los navegadores modernos bloquean el almacenamiento de terceros, así que
`signInWithRedirect` + `getRedirectResult` no recuperan la sesión.

## Solución temporal (código)

Puente same-origin en Hosting:

1. En `pedalmap.es` → redirige a `https://pedalmap-79b3a.web.app/auth/bridge?return=…`
2. Ahí Google redirect funciona (`authDomain` = host).
3. El Worker `POST /auth/custom-token` emite un custom token (service account).
4. Vuelve a `pedalmap.es/login#pm_ct=…` y `signInWithCustomToken` restaura la sesión.

## Solución permanente (consola)

En Google Cloud → Credenciales → cliente OAuth web de Firebase, añade:

- Orígenes JS: `https://pedalmap.es`, `https://www.pedalmap.es`
- Redirect URIs: `https://pedalmap.es/__/auth/handler`, `https://www.pedalmap.es/__/auth/handler`

Después se puede poner `authDomain = pedalmap.es` y retirar el puente.
