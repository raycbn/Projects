# SECURITY — PedalMap

## Principios

1. Nunca confiar solo en el frontend
2. Minimizar secretos en el cliente
3. Reglas Firestore estrictas (desplegadas en `pedalmap-79b3a`)
4. Validación Zod en borde de aplicación
5. RGPD: minimización + consentimiento

## API keys

- `VITE_ORS_API_KEY` solo vía secrets / `.env.local` (gitignored)
- Producción: preferir proxy Cloud Functions
- Nunca subir `.env` / `.env.local`
- No Firebase Admin / service accounts en el cliente

## Firestore rules (validación live 2026-08-09)

| Comprobación | Resultado |
|--------------|-----------|
| Usuario crea su perfil | 200 |
| Auto-upgrade `free→premium` | **403** |
| Crear ruta propia | 200 |
| Anónimo lee ruta privada | **403** |
| Anónimo lee ruta pública | 200 |
| Anónimo lee `routeShares` | 200 |
| Cliente escribe `subscriptions` | **403** |

Rules file: `firebase/firestore.rules` — no cambiar sin necesidad.

## Auth

- Email/password + Google + anonymous preparados
- Dominios autorizados deben incluir el host de preview (Cloudflare) y producción
- Persistencia: Firebase Auth por defecto (indexedDB)

## Geocoding

Nominatim puede bloquear IPs de datacenter (403). Fallback Photon automático. No inventar resultados.
