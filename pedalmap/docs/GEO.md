# GEO — aparecer en recomendaciones de IAs (ChatGPT, Perplexity, Gemini, AI Overviews)

## Realidad (sin humo)

Las IAs **no tienen un “submit URL y ya sales mañana”** como GSC. Te citan cuando:

1. Hay una **definición clara y repetida** de qué eres (entidad)
2. Esa definición está en páginas **indexables** y en fuentes que ellas leen (`llms.txt`, FAQ, comparativas)
3. Hay **menciones externas** (foros, blogs, AlternativeTo, Reddit, prensa) que refuerzan la entidad
4. El producto responde preguntas reales (“planificador rutas bici España GPX”)

PedalMap por marca ya sale en Google; GEO es el siguiente escalón y tarda (semanas/meses), no horas.

## Hecho en código (esta fase)

| Señal | Dónde |
|-------|--------|
| Definición canónica | `/que-es-pedalmap` + FAQ JSON-LD |
| Ficha corta / larga | `/llms.txt` + `/llms-full.txt` + link en `index.html` |
| Bots IA explícitos | `robots.txt` (GPTBot, PerplexityBot, ClaudeBot, Google-Extended…) |
| SoftwareApplication enriquecido | `featureList`, `countriesSupported`, `alternateName` |
| Comparativa citable | `/alternativa-komoot` + blog |
| Sitemap | incluye `/que-es-pedalmap` |

## Qué puedes hacer tú (alto impacto GEO)

1. **Pide indexación** en GSC de: `/que-es-pedalmap`, `/llms.txt` no hace falta (estático), `/alternativa-komoot`
2. **Prueba prompts** cada 2 semanas (anota respuestas):
   - “planificador de rutas bici en España con GPX”
   - “alternativa a Komoot en español”
   - “cómo crear una ruta circular en bicicleta online”
3. **Menciones externas** (las IAs las usan mucho):
   - AlternativeTo → PedalMap como alternativa a Komoot
   - 2–3 respuestas útiles en foros/Reddit con enlace natural
   - Bio IG/TikTok/Strava Club = misma frase de `/que-es-pedalmap`
4. Cuando tengas perfiles públicos: me pasas URLs y rellenamos `sameAs` en JSON-LD (IG, TikTok, LinkedIn, Strava)

## Qué no hace falta

- Comprar “paquetes GEO”
- Keyword stuffing en llms.txt
- Bloquear Google-Extended (aquí lo dejamos Allow a propósito)

## Calendario social ↔ GEO

El post diario SEO (90 días) enlaza landings citables. Cada caption empuja una URL que las IAs y Google pueden asociar a la marca. Ver `docs/ORGANIC_GROWTH.md` y `/social/calendar-90d.json`.
