# Grabación nativa PedalMap (auto-guardar + Free > Strava Free)

## Producto

Objetivo: al **Finalizar** una salida GPS en PedalMap, la actividad ya está en la nube y se abre el análisis — sin pasos extra y **sin mencionar Strava**.

```
Usuario graba en PedalMap (móvil)
        │
        ▼
   Finalizar
        │
        ▼
 Firestore `activities`  →  /actividades/:id (análisis Free)
```

Para sync automático desde un ciclocomputador (iGPSPORT, etc.) sin abrir Strava hace falta API oficial del fabricante (callback) o import FIT/GPX. El puente Strava queda fuera de la UI principal.

## Free analytics (más que Strava Free básico)

Además de distancia / tiempo / desnivel +:

| Métrica | Notas |
|---------|--------|
| Tiempo en movimiento | Excluye pausas y gaps largos |
| Desnivel − / máx-mín | Perfil DEM sanitizado |
| Vel. media / máx | GPS `coords.speed` o derivada |
| Pendiente media / máx | Free |
| VAM (m/h) | Ritmo de ascenso |
| Potencia estimada | Modelo aero+rodadura+gravedad (sin potenciómetro) |
| kcal estimadas | Desde trabajo mecánico |
| Splits por km | Free (Strava oculta mucho análisis detrás de Premium) |

## UX

- `/actividad` — grabar; al finalizar → `/actividades/:id`
- `/actividades` — historial nativo
- Código Worker Strava puede existir para opt-in futuro, pero **no se muestra** en la UI principal
