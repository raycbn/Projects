# Pack Grupeta — Stripe + seguridad

## Producto

| | Individual | Pack Grupeta |
|--|--|--|
| Plazas | 1 | **4** (pagador + 3 emails) |
| Mensual | 4,99 € · sin trial | **14,99 €** · sin trial |
| Anual | 39,99 € · 7 días trial | **119,99 €** · 7 días trial |
| Asignación | — | **Después del pago** en `/premium#grupeta` |

No hay cupón `GRUPETA`. El checkout del pack **no** admite promotion codes (evita apilar descuentos).

## Crear precios LIVE

```bash
cd pedalmap
STRIPE_SECRET_KEY=sk_live_… node scripts/create-grupeta-stripe-prices.mjs
```

Copia los `price_…` a `workers/api/wrangler.toml`:

```toml
STRIPE_PRICE_GRUPETA_MONTHLY = "price_…"
STRIPE_PRICE_GRUPETA_YEARLY = "price_…"
```

Luego: `npm run worker:deploy`.

TEST (ya creados en cuenta test):  
`price_1U3bTpDRDu30ohSLAjHzG2bx` (mes) · `price_1U3bTpDRDu30ohSLxl8VRpE6` (año) → van en `.dev.vars` local.

## Flujo seguro (anti falso Premium)

1. Cliente **no puede** escribir `users.plan` (Firestore rules).
2. Checkout Stripe con `metadata.product=grupeta` + `firebaseUid`.
3. Webhook firmado → Admin escribe `subscriptions/{uid}` + `users.plan` + `grupetaPacks/{ownerUid}`.
4. Dueño llama `POST /grupeta/seats` (auth + pack `active|trialing`) → Admin actualiza asientos e índice.
5. Compañero hace login → `POST /me/sync-plan` comprueba `grupetaSeatIndex` + pack billable → Admin `plan=premium`.
6. Cancelación / impago → pack inactive + revoke (salvo otra sub propia activa o allowlist ops).

Colecciones Admin-only write: `grupetaPacks`, `grupetaSeatIndex`.

## Publicar rules

Firebase Console → Firestore → Rules → pegar `firebase/firestore.rules` (incluye bloques Grupeta) → Publish.
