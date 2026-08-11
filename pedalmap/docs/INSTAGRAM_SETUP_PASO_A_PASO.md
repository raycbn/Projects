# Instagram PedalMap — paso a paso (para que yo lo automatice)

Hazlo en el **móvil** con calma. Cuando acabes el **Paso 5**, me mandas 2 datos y yo publico por ti.

---

## Paso 1 — Instagram profesional (2 min)

1. Abre la app **Instagram** → perfil PedalMap  
2. Menú ☰ → **Configuración y actividad**  
3. **Cuenta** → **Cambiar a cuenta profesional**  
4. Elige **Empresa** (o Creador; Empresa vale)  
5. Categoría: **Aplicación / Software** o **Deporte**  
6. Completa y listo  

---

## Paso 2 — Página de Facebook (3 min)

1. En el móvil, instala/abre **Facebook** (misma cuenta Meta que usarás)  
2. Crea una **Página**: nombre **PedalMap**  
3. Vuelve a Instagram → ☰ → **Cuenta** → **Cuentas centro** / **Cuenta vinculada**  
4. **Vincular** Instagram ↔ Página Facebook PedalMap  

(Si no ves “vincular”, en Instagram: Configuración → Cuenta → Compartir en Facebook / Cuentas vinculadas.)

---

## Paso 3 — Meta Business Suite (comprobar que Meta te ve)

1. En Chrome móvil: [https://business.facebook.com](https://business.facebook.com)  
2. Inicia sesión  
3. Debe aparecer **PedalMap** (IG + Página)  
4. Prueba: **Crear publicación** → Instagram → una foto → **Programar** (o publicar)  

Si esto funciona, la cuenta ya es válida para API.

---

## Paso 4 — App de desarrollador Meta (para que YO publique)

1. En el móvil o PC: [https://developers.facebook.com](https://developers.facebook.com)  
2. **Mis apps** → **Crear app** → tipo **Business** → nombre `PedalMap Social`  
3. En el panel de la app, añade el producto **Instagram** (Instagram Graph API / API setup)  
4. **Roles** → añádete como administrador (ya lo estás)  
5. **Herramientas** → **Explorador de la API de Graph** (Graph API Explorer):  
   - App: PedalMap Social  
   - Usuario o Página: elige la **Página PedalMap**  
   - Permisos (añadir):  
     - `pages_show_list`  
     - `pages_read_engagement`  
     - `instagram_basic`  
     - `instagram_content_publish`  
   - **Generate Access Token** → autoriza todo  

### Conseguir el IG User ID
En Graph API Explorer, llama:

```
GET /me/accounts
```

Entra en la Página → campo `instagram_business_account` → `id`  
Ese `id` es tu **INSTAGRAM_IG_USER_ID** (números largos).

O:

```
GET /{page-id}?fields=instagram_business_account
```

### Token de larga duración
El token del Explorer caduca pronto. En Graph Explorer o docs Meta:
1. Con el token corto, intercambia a **long-lived user token** (~60 días)  
2. O genera **Page token** de larga duración  

Guarda ese string: **INSTAGRAM_ACCESS_TOKEN**

> En modo **Development**, puedes publicar en TU cuenta sin App Review.  
> App Review solo hace falta si otras personas usan la app.

---

## Paso 5 — Mándame esto por el chat (privado)

Copia y pega (o captura):

1. `INSTAGRAM_IG_USER_ID=` (solo números)  
2. `INSTAGRAM_ACCESS_TOKEN=` (el long-lived)  

Yo haré:
- `wrangler secret put` de esos + un `INSTAGRAM_OPS_TOKEN`  
- Publicaré posts desde el Worker (`/ops/instagram/publish`)  
- Usaré las fotos ya en `https://pedalmap.es/social/...jpg`

**No hace falta** que me des la contraseña de Instagram nunca.

---

## Mientras tanto (si quieres posts YA)

Usa **Meta Business Suite → Programar** con los pies de foto que ya te di.  
Cuando me pases el token, paso yo a publicar la cola automáticamente.

---

## Checklist rápido

- [ ] IG profesional  
- [ ] Página Facebook PedalMap  
- [ ] IG vinculada a la Página  
- [ ] Business Suite ve la cuenta  
- [ ] App Meta + token + IG User ID  
- [ ] Me los envías → yo automatizo  
