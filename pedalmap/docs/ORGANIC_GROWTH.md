# Crecimiento orgánico PedalMap — publicidad gratuita + automatización 90 días

## Principio

Google ya encuentra **PedalMap** por marca. Ahora: rankear por intención + **ser citables por IAs** (`docs/GEO.md`) + **1 post SEO/día durante ~3 meses**.

---

## Automatización 90 días (1 post/día)

### Qué hay listo en código

| Artefacto | Uso |
|-----------|-----|
| `https://pedalmap.es/social/calendar-90d.json` | Cola completa (caption + imagen + keyword + URL) |
| `https://pedalmap.es/social/calendar-90d.csv` | Import Buffer / hoja de cálculo |
| Worker cron `0 8 * * *` UTC (~10:00 Madrid invierno) | Publica 1 foto/día en Instagram si hay secrets |
| `GET /ops/instagram/schedule` | Estado + próximos 7 posts (header `X-PedalMap-Ops-Token`) |
| `POST /ops/instagram/schedule/run` | Forzar / dryRun `{ "dryRun": true }` o `{ "forceDay": 3 }` |
| `SOCIAL_CAMPAIGN_START` | Default `2026-08-12` (wrangler vars) |

Imágenes ya públicas: `https://pedalmap.es/social/*.jpg`

### Cómo activar el piloto automático (Instagram)

1. Cuenta IG **Profesional** (sin Página FB si no quieres) — `docs/INSTAGRAM_SETUP_PASO_A_PASO.md`
2. App Meta + token long-lived + `INSTAGRAM_IG_USER_ID`
3. En el Worker:
   ```bash
   cd workers/api
   npx wrangler secret put INSTAGRAM_ACCESS_TOKEN
   npx wrangler secret put INSTAGRAM_IG_USER_ID
   npx wrangler secret put INSTAGRAM_OPS_TOKEN   # inventa un secreto largo
   npx wrangler deploy
   ```
4. Comprueba: `GET …/ops/instagram/schedule` con el header ops
5. Dry-run: `POST …/ops/instagram/schedule/run` body `{"dryRun":true}`

Sin tokens, el cron **no rompe nada**: registra skip y sigue. La cola JSON/CSV sirve igual para **Buffer / Meta Business Suite** a mano.

### TikTok / LinkedIn / YouTube

No hay API tan limpia gratis. Usa el **mismo CSV**: 1 fila/día, mismo caption, creativo de `/social/`. Buffer/Later cubren multi-canal.

### Engagement (humano, no bot)

Responder comentarios y DMs sigue siendo manual. El cron solo **publica** contenido SEO útil.

---

## GEO / IAs (resumen)

- Página entidad: https://pedalmap.es/que-es-pedalmap
- Fichas: `/llms.txt` + `/llms-full.txt`
- Guía: `docs/GEO.md`

Tras el deploy: en GSC solicita indexación de `/que-es-pedalmap` (además del sitemap que ya enviaste).

---

## Speech comunidades (sigue válido)

### Corta
Hola. Os dejo PedalMap (pedalmap.es), planificador de rutas bici para España: tipo de bici, desnivel, superficie, viento y GPX a Garmin/Wahoo. Free. Guías: https://pedalmap.es/blog

### Media / admin estricto
Ver versiones anteriores en git o pide el pack otra vez — tono humilde, no spam.

---

## Keywords que rota el calendario

crear ruta bicicleta · GPX Garmin/Wahoo · circular · viento · desnivel · gravel · MTB · alternativa Komoot · ciudades ES · grupeta · planificador España
