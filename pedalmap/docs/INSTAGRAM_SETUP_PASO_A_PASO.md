# Instagram PedalMap — sin Página de Facebook personal

## Tu duda (correcta)

Crear una **Página de Facebook** obliga a partir de un perfil Meta.  
Eso **no sale en el perfil público de Instagram**, pero en el backend de Meta sí hay un humano admin. No existe un Instagram Business 100 % anónimo dentro de Meta.

Lo que sí podemos hacer: **no vincular Página**, no mostrar tu nombre en la marca, y automatizar con la vía oficial **Instagram Login** (sin Facebook Page).

---

## Opción A (recomendada) — Solo Instagram profesional

**No crees Página de Facebook para PedalMap.**

1. Instagram → cuenta **Profesional** → tipo **Creador** o **Empresa**  
2. **No** pulses “conectar Página de Facebook”  
3. Bio: PedalMap + `pedalmap.es`  
4. Publicas/programas desde la app IG (nativo) mientras tanto  

Para que **yo** publique por API (sin Página):

### App Meta (sí hace falta un login Meta para *crear la app*)
- Eso es solo para **developers.facebook.com** (dueño técnico de la app).  
- Los seguidores de IG **no ven** ese perfil.  
- Ideal: usa un Facebook **solo de operaciones** (`ops` / correo `hola@pedalmap.es`), no tu muro personal ni amigos reales.  
- O usa tu Facebook personal **solo como admin de la app**, sin vincularlo al IG público.

### Producto en la app
1. [developers.facebook.com](https://developers.facebook.com) → crear app Business `PedalMap Social`  
2. Añadir **Instagram API with Instagram Login** (Business Login for Instagram)  
3. Permisos / scopes:  
   - `instagram_business_basic`  
   - `instagram_business_content_publish`  
4. Login de prueba con la cuenta **@PedalMap** (Instagram), no con “Página”  
5. Obtén:  
   - `INSTAGRAM_IG_USER_ID`  
   - `INSTAGRAM_ACCESS_TOKEN` (long-lived)  
6. Pégamelos aquí  

Nuestro Worker usa por defecto `graph.instagram.com` (esta vía).

---

## Opción B — Página Facebook (solo si más adelante quieres Ads)

Si algún día haces **anuncios Meta** o catálogo, entonces sí hace falta Página.  
Para minimizar huella:

- Página “PedalMap” (marca)  
- Visitantes ven la Página, **no tu perfil personal**  
- En privacidad FB: no listar Páginas en tu perfil, no aceptar desconocidos  
- Admin: puedes añadir luego a `raymel` / otro sin que salga públicamente  

Hasta que no hagas Ads, **no hace falta**.

---

## Qué no existe

- Instagram Business “empresa española” sin ninguna identidad Meta detrás  
- Automatizar IG con usuario/contraseña (apps así = ban)

---

## Qué hacer tú ahora (mínimo)

1. IG Profesional (**sin** vincular Página)  
2. Seguir publicando a mano / programar en la app  
3. Cuando quieras que yo publique: App Meta + **Instagram Login** + mandarme ID + token  

Si te incomoda hasta el Facebook “ops”, lo dejamos en **manual + Business Suite later**; el producto PedalMap no depende de eso.
