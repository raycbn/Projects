# Google login en `pedalmap.es`

## Estado (2026-08-11)

En Google Cloud Console el cliente OAuth de Firebase ya incluye:

- Orígenes JS: `https://pedalmap.es`, `https://www.pedalmap.es`
- Redirect URIs: `https://pedalmap.es/__/auth/handler`, `https://www.pedalmap.es/__/auth/handler`

El SDK usa `authDomain = window.location.hostname` en esos hosts (first-party),
así que `signInWithRedirect` funciona en móvil sin puente.

## Puente de emergencia

El flujo vía `https://pedalmap-79b3a.web.app/auth/bridge` + custom token del Worker
sigue en el código. Solo se activa con:

```bash
VITE_FORCE_GOOGLE_AUTH_BRIDGE=true
```

Úsalo si alguien quita los redirect URIs de la consola y el login vuelve a fallar.

## Problema original

Con `authDomain = *.web.app` y app en `pedalmap.es`, los navegadores bloquean el
almacenamiento de terceros: tras elegir la cuenta de Google el usuario volvía a
`/login` sin sesión.
