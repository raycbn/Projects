# SEO — PedalMap

## Principios

- Contenido útil para ciclistas reales
- **No** keyword stuffing ni miles de páginas vacías
- Meta title/description/canonical/OG por página
- `robots.txt` + `sitemap.xml`

## Páginas Fase 1

| Ruta | Intención |
|------|-----------|
| `/` | Brand + conversión a planificador |
| `/route-planner` | Herramienta (indexable con cuidado) |
| `/crear-ruta-bicicleta` | Long-tail |
| `/planificador-rutas-bici` | Long-tail |
| `/crear-ruta-gpx` | Long-tail |
| `/rutas-bicicleta-madrid` | Local |
| `/rutas-mtb-madrid` | Local MTB |
| `/rutas-gravel-madrid` | Local gravel |
| `/premium` | Monetización |
| `/privacidad` | Confianza / RGPD |

## Implementación actual

- SPA React + `usePageMeta` actualiza title/meta/canonical en cliente
- FAQ en landing con preguntas reales
- Sitemap estático en `public/sitemap.xml`

## Mejoras futuras (recomendadas)

1. Prerender/SSG de landing + páginas SEO (vite-plugin-ssr / prerender)
2. JSON-LD `FAQPage` / `SoftwareApplication`
3. Blog de salidas reales (contenido editorial)
4. Páginas de rutas públicas indexables `/route/{slug}` con meta dinámica server-side

## Keywords objetivo (no spam)

- creador / planificador rutas bicicleta
- crear ruta GPX
- rutas bicicleta / MTB / gravel Madrid
- calcular desnivel ruta bici
