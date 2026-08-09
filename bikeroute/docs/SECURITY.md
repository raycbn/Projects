# SECURITY — BikeRoute

## Principios

1. Nunca confiar solo en el frontend
2. Minimizar secretos en el cliente
3. Reglas Firestore/Storage estrictas
4. Validación Zod en borde de aplicación
5. RGPD: minimización + consentimiento

## API keys

- `VITE_ROUTING_API_KEY` puede usarse en desarrollo
- Producción: proxy Cloud Functions (`VITE_ROUTING_PROXY_URL`)
- Nunca subir `.env`
- Stripe secrets solo server-side

## Firestore rules (resumen)

| Colección | Lectura | Escritura |
|-----------|---------|-----------|
| users | owner | owner (sin auto-upgrade plan) |
| routes | owner o `isPublic` | owner |
| routeShares | pública | owner |
| favorites | owner | owner |
| activities | owner | owner |
| subscriptions | owner | **solo Admin/Functions** |

Archivo: `firebase/firestore.rules`

## Auth

- Google + email/password + anonymous
- Reset password vía Firebase
- Rutas ajenas: comprobación `userId` en repository + rules

## Inputs

- Waypoints limitados (2–20)
- Títulos ≤ 120 chars
- GPX Storage ≤ 5 MB (cuando se active)
- Mensajes de error al usuario sin stack traces

## Rate limiting

- Entitlements freemium en cliente (UX)
- Cuotas ORS / Nominatim
- Rate limit real en Functions (Fase 4)

## Privacidad / RGPD

- No guardar ubicación continua
- Geolocalización solo con permiso del navegador
- Analytics stub sin PII
- Páginas `/privacidad` y `/cookies`
