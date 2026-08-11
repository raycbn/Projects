# Instagram automation PedalMap — qué sí / qué no

## Veredicto (2026)

| Objetivo | ¿Se puede automatizar? | Cómo |
|----------|------------------------|------|
| Subir posts / carruseles / Reels en horario | **Sí** | Meta Business Suite (gratis) o Buffer/Later (API oficial) |
| Publicar desde código (nuestro Worker) | **Sí, pero lento de montar** | Instagram Graph API + cuenta Professional + App Review Meta (días/semanas) |
| Likes / follows / comments fake / “crecimiento mágico” | **No** | Viola normas → ban. No lo hacemos |
| Responder DMs / comentarios a escala | Parcial | ManyChat / Meta + reglas; mejor manual al principio |

**Scheduling oficial no baja el alcance** (estudios Hootsuite/Buffer). Lo que baja el alcance es contenido flojo o spam.

---

## Camino recomendado esta semana (sin programar)

### 1) Cuenta lista
1. Instagram → **Cuenta profesional** (Empresa o Creador)
2. Conectar a una **Página de Facebook** “PedalMap”
3. En bio: link a `https://pedalmap.es` (o Linktree con planificador + blog)

### 2) Programar gratis — Meta Business Suite
1. En el móvil/PC: [business.facebook.com](https://business.facebook.com) → **Meta Business Suite**
2. Conectar IG PedalMap
3. **Crear publicación** → Instagram → subir foto → pie → **Programar**
4. Ritmo PedalMap: **1 post/día** o **5/semana** (calidad > cantidad)

Alternativa simple de pago: **Buffer** (~5 €/canal/mes) si quieres cola más cómoda.

### 3) API propia (solo si quieres full auto desde PedalMap)
Requisitos Meta:
- App en developers.facebook.com
- Permisos `instagram_content_publish` (App Review)
- Token de larga duración + refresh
- Imágenes en URL pública (p. ej. `pedalmap.es/...` o R2)

Límite típico: ~50–100 publicaciones API / 24 h (consultar `content_publishing_limit`).  
Esto lo montamos en el Worker **cuando tengas Professional + Página FB** y me pases acceso/token (no hace falta antes).

---

## Engagement de verdad (entrar al perfil)

El algoritmo premia: **guardados, comentarios, tiempo, perfiles visitados**.

### Fórmulas de post que sí meten gente al perfil
1. **Gancho + promesa + CTA perfil**  
   “¿Exportas GPX a Garmin? En el perfil tienes la guía completa 👆”
2. **Pregunta real** (comentar = boost)  
   “¿Garmin, Wahoo o móvil? Comenta 1️⃣ 2️⃣ 3️⃣”
3. **Carrusel valor** (3–5 slides) → último slide: “Síguenos + link en bio”
4. **Antes/después** (improvisar vs planificar desnivel)
5. **Error común**  
   “El error #1 al crear una ruta en bici…” → “Más en perfil / bio”

### CTA que convierten a web
- Bio siempre: `pedalmap.es`
- En caption: 1 solo link path claro (`/route-planner`, `/blog/...`)
- Stories (manual 2–3/día): encuesta + sticker link si tienes ≥10k o usar “menciona en stories” + bio

### Qué NO hacer
- Comprar seguidores / likes
- Apps que piden tu contraseña de Instagram
- 20 hashtags basura; 8–12 relevantes bastan
- Postear 5 veces/día vacío

---

## Calendario 7 días (engagement → perfil)

| Día | Tipo | Gancho | CTA |
|-----|------|--------|-----|
| 1 | Pregunta | ¿Garmin, Wahoo o OsmAnd? | “Guías en el perfil 👆” |
| 2 | Valor GPX | Error al pasar GPX al Edge | Link bio → blog Garmin |
| 3 | Carrusel 4 | Cómo crear ruta en 4 pasos | “Prueba gratis → bio” |
| 4 | Local | Madrid / tu ciudad | Guía ciudad en bio |
| 5 | Mito | “Los km no mienten” (sí mienten: el desnivel) | Planificador en bio |
| 6 | Social proof / producto | Free vs Premium en 1 imagen | `/premium` |
| 7 | Comunidad | “¿Qué salida preparáis el finde?” | Responder TODOS los comments |

---

## Siguiente paso práctico

1. **Cola 90 días lista:** `/social/calendar-90d.json` + `.csv` (Buffer) o cron Worker (Instagram API)
2. Tú: IG Profesional + tokens → secrets del Worker (ver `docs/ORGANIC_GROWTH.md`)
3. GEO / IAs: `docs/GEO.md` + página `/que-es-pedalmap`

Avisos legales: automatizamos **publicación**; el engagement lo construimos con contenido y respuesta humana, no con bots.
