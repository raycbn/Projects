# Google login en `pedalmap.es`

## Estado (2026-08-11)

Flujo principal: **Google Identity Services** (`accounts.google.com/gsi/client`)
pide un access token y Firebase hace `signInWithCredential`. No usa
`signInWithRedirect` ni `/__/auth/handler`, así evita el fallo típico de
“vuelve al login sin sesión”.

También:

- `authDomain` = hostname en `pedalmap.es` / www (OAuth URIs ya registrados)
- Service worker **no intercepta** `/__/*` (cache `pedalmap-shell-v5`)

## Consola Google (ya hecho)

- Orígenes JS: `https://pedalmap.es`, `https://www.pedalmap.es`
- Redirect URIs: `https://pedalmap.es/__/auth/handler`, `https://www.pedalmap.es/__/auth/handler`

## Fallbacks

1. Si GIS falla → Firebase `signInWithPopup` / `signInWithRedirect`
2. `VITE_FORCE_GOOGLE_AUTH_BRIDGE=true` → puente `*.web.app` + custom token Worker
