# Objetivo agosto: ~100 usuarios + SEO agresivo

## Honestidad primero

- **Ser #1 en Google** en keywords competitivas (“planificador rutas bici”, “alternativa Komoot”) en ~2–3 semanas es **muy improbable**. SEO es semanas/meses.
- **100 usuarios registrados a fin de agosto** sí es alcanzable si combinas: producto usable + distribución (grupetas, foros, Strava, Reels) + SEO que ya indexa. SEO solo no basta.

Hoy el código empuja SEO (blogs + landings). Tú empujas distribución diaria.

## Qué quedó automatizado / listo (sin Instagram)

| Pieza | Qué hace |
|-------|----------|
| `blogPostsExtra.ts` | +20 artículos SEO (comparativas, destinos, verano, GPX…) |
| `npm run blog:validate` | Valida slugs/campos antes de build |
| `npm run sitemap:sync` | Regenera `sitemap.xml` desde blogs + guías (en cada build) |
| Landings nuevas | vs Strava, vs RwGPS, Casa de Campo, Collserola, calor verano, Navacerrada |

**Publicar más blogs =** añadir posts en `src/content/blogPostsExtra.ts` (o un nuevo `blogPostsSep.ts`), `npm run build` / deploy. No hace falta Instagram.

Ritmo sostenible: **3–5 posts nuevos / semana** + reenviar sitemap en GSC.

## Plan 100 usuarios (acciones tuyas, 0 €)

### Cada día (15–25 min)
1. 1 mensaje útil en 1 grupeta/foro donde ya estés (speech de `ORGANIC_GROWTH.md`)
2. 1 story/Reel o post Buffer desde el CSV (manual; IG API aparcada)
3. Responder a quien pruebe la app

### Esta semana
1. GSC → indexar `/que-es-pedalmap` + `/blog` + 5 posts nuevos clave
2. Bing Webmaster + mismo sitemap
3. AlternativeTo: PedalMap vs Komoot / Bikemap
4. Strava Club PedalMap + bio con la definición canónica
5. Pedir a 10 amigos ciclistas: cuenta Free + 1 ruta (semilla de uso real)

### Conversión in-app (ya existe Free)
- CTA claro: calcular sin cuenta → guardar pide registro (embudo natural)
- Comparte 1 ruta ejemplo con captura real del mapa (confianza)

## Keywords a vigilar en GSC (no obsesionarse con #1 global)

1. crear ruta bicicleta  
2. crear ruta GPX / GPX Garmin  
3. planificador rutas bici  
4. alternativa Komoot  
5. rutas bicicleta Madrid / Barcelona  
6. PedalMap (marca — ya OK)

Cuando una query esté en posiciones 8–20: refuerza esa URL (enlace interno + 1 párrafo), no crees otra página.

## Métrica de éxito 31 ago

| Métrica | Objetivo realista |
|---------|-------------------|
| Cuentas Free | ~100 (estirado pero posible con distribución) |
| Rutas calculadas | >300 |
| URLs indexadas GSC | blog + guías principales |
| Top 1 marca “PedalMap” | mantener |
| Top 10 keyword genérica | 1–3 queries long-tail (éxito parcial) |

Si a 20 ago vais <30 users: doblar distribución humana (grupetas), no solo más blogs.
