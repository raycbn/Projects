# Correos PedalMap (`@pedalmap.es`)

Buzones públicos (IONOS):

| Buzón | Uso |
|-------|-----|
| `hola@pedalmap.es` | Contacto general / footer / Nominatim |
| `soporte@pedalmap.es` | Legal, privacidad, soporte |
| `premium@pedalmap.es` | Facturación / Premium |
| `aviso@pedalmap.es` | Avisos de viento (From Resend) |
| `noreply@pedalmap.es` | Transaccional sin respuesta |

Gmails de desarrollo (`rayvf2002@…`, `raymel.vb@…`) van solo en el **secret** `PREMIUM_ALLOWLIST` del Worker — nunca en UI ni en git.

---

## Google / Firebase: por qué no te deja cambiar el email

El desplegable **solo lista cuentas Google que son miembros del proyecto**.  
`soporte@pedalmap.es` no aparece hasta que exista una **cuenta Google** con ese correo y la invites al proyecto.

### Pasos (una vez)

1. Abre [crear cuenta Google](https://accounts.google.com/signup) → **Usar mi dirección de correo electrónico actual**.
2. Pon `soporte@pedalmap.es` (recibe el código en el buzón IONOS).
3. Completa el alta (puedes saltar teléfono si Google lo permite).
4. **Firebase / Google Cloud** → IAM / Usuarios del proyecto → **Añadir miembro**  
   - Principal: `soporte@pedalmap.es`  
   - Rol: Editor (o Owner).
5. Cierra sesión y entra en Firebase/GCP **con** `soporte@pedalmap.es` una vez (acepta la invitación).
6. Vuelve a **Configuración pública** / **Pantalla de consentimiento OAuth**:
   - Correo de asistencia → elige `soporte@pedalmap.es`.
7. Rellena también (usuarios lo ven en el login Google):
   - Nombre de la app: `PedalMap` (no el project-…)
   - Página principal: `https://pedalmap.es`
   - Privacidad: `https://pedalmap.es/privacidad`
   - Términos: `https://pedalmap.es/terminos`
   - Dominios autorizados: `pedalmap.es`, `www.pedalmap.es`

Repite el mismo truco con `hola@` solo si quieres otra identidad Google.

**Stripe:** el “Google account” de Ray con Gmail es solo para entrar al Dashboard. Los clientes ven `premium@` / `soporte@` que ya cambiaste — OK dejar el Gmail conectado.

---

## Resend (envío) + DNS IONOS (punto 5–6)

DNS actual: **IONOS** (`mx00/mx01.ionos.es`, SPF IONOS). Los MX se quedan para **recibir**. Resend solo **envía**.

### 1) Cuenta Resend

1. [resend.com](https://resend.com) → Sign up (ideal con `hola@` o `soporte@`).
2. Domains → **Add** `pedalmap.es`.
3. Copia los registros que te den (normalmente varios **CNAME** DKIM + a veces TXT).

### 2) IONOS → DNS de `pedalmap.es`

En el panel DNS del dominio:

1. Añade **exactamente** los CNAME/TXT que muestra Resend (no borres los MX).
2. Actualiza el **SPF** (TXT raíz). Ahora tienes algo como:
   ```text
   v=spf1 include:_spf-eu.ionos.com ~all
   ```
   Debe quedar **un solo** TXT SPF, por ejemplo:
   ```text
   v=spf1 include:_spf-eu.ionos.com include:amazonses.com ~all
   ```
   (Resend te dirá el `include:` exacto; suele ser `amazonses.com`.)
3. Opcional DMARC (TXT `_dmarc`):
   ```text
   v=DMARC1; p=none; rua=mailto:soporte@pedalmap.es
   ```
4. En Resend → Verify domain (puede tardar minutos).

### 3) Worker

```bash
cd pedalmap/workers/api
# API key de Resend (re_…)
echo 're_…' | npx wrangler secret put RESEND_API_KEY
npm run deploy
```

`MAIL_FROM` en `wrangler.toml` [vars]:

```toml
MAIL_FROM = "PedalMap <aviso@pedalmap.es>"
```

### 4) Probar

Con sesión iniciada en la app y avisos email activos, o:

```bash
curl -sS -X POST https://pedalmap-api.broken-dietician.workers.dev/alerts/email \
  -H "Authorization: Bearer <ID_TOKEN_FIREBASE>" \
  -H "Content-Type: application/json" \
  -d '{"routeTitle":"Prueba","caption":"test","score":90,"routeId":"x","startHour":"2026-08-12T07:00","endHour":"2026-08-12T10:00"}'
```

Respuesta esperada: `{ "ok": true, "sent": true }`.

---

## Checklist rápido

- [ ] Cuenta Google `soporte@` + miembro del proyecto Firebase/GCP
- [ ] Support email OAuth + Firebase = `soporte@pedalmap.es`
- [ ] Nombre app PedalMap + URLs legales en consentimiento OAuth
- [ ] Dominio verificado en Resend (DNS IONOS)
- [ ] `RESEND_API_KEY` en Worker
- [ ] Prueba de envío `sent: true`
