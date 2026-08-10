import { useEffect, useState } from 'react'
import type { RouteDraft } from '@/domain/types'
import {
  weatherService,
  type RideWindowAdvice,
  type RouteWeatherForecast,
} from '@/services/WeatherService'
import { track } from '@/lib/analytics'
import clsx from 'clsx'

interface RouteWeatherPanelProps {
  route: RouteDraft
}

function formatWindowDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatHourRange(start: string, end: string): string {
  return `${start.slice(11, 16)}–${end.slice(11, 16)}`
}

function scoreClass(label: RideWindowAdvice['label']): string {
  switch (label) {
    case 'excelente':
      return 'bg-[color-mix(in_oklab,var(--color-signal)_35%,white)] text-[var(--color-forest)]'
    case 'buena':
      return 'bg-[color-mix(in_oklab,var(--color-trail)_22%,white)] text-[var(--color-forest)]'
    case 'aceptable':
      return 'bg-[#fff7e8] text-[#7a4d00]'
    default:
      return 'bg-[#fff0f0] text-[var(--color-danger)]'
  }
}

export function RouteWeatherPanel({ route }: RouteWeatherPanelProps) {
  const [forecast, setForecast] = useState<RouteWeatherForecast | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void weatherService
      .forecastForRoute(route.geometry, { forecastDays: 7 })
      .then((data) => {
        if (cancelled) return
        setForecast(data)
        const firstDay = data.windows[0]?.startHour.slice(0, 10) ?? null
        setSelectedDay(firstDay)
        track('weather_forecast_loaded', { windows: data.windows.length })
      })
      .catch((err) => {
        console.error('[weather]', err)
        if (!cancelled) setError('No se pudo cargar el viento/meteo (Open-Meteo).')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [route.geometry])

  const days = forecast
    ? [...new Set(forecast.windows.map((w) => w.startHour.slice(0, 10)))]
    : []
  const dayWindows = forecast?.windows
    .filter((w) => !selectedDay || w.startHour.startsWith(selectedDay))
    .sort((a, b) => a.startHour.localeCompare(b.startHour))

  const top = forecast?.windows[0]

  return (
    <section className="space-y-3 rounded-2xl bg-white/85 p-3 ring-1 ring-[var(--color-fog)]">
      <div>
        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
          Viento y mejor salida
        </h2>
        <p className="text-xs text-[var(--color-stone)]">
          Previsión gratis (Open-Meteo) según el trazado de la ruta. Elige día/hora con menos cara
          y lluvia.
        </p>
      </div>

      {loading && <p className="text-sm text-[var(--color-stone)]">Calculando viento…</p>}
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {forecast && (
        <>
          <p className="text-xs text-[var(--color-stone)]">
            Rumbo medio ruta:{' '}
            <strong className="text-[var(--color-forest)]">
              {forecast.routeBearingLabel ?? '—'}
              {forecast.routeBearingDeg != null ? ` (${Math.round(forecast.routeBearingDeg)}°)` : ''}
            </strong>
            {top && (
              <>
                {' '}
                · Mejor ventana:{' '}
                <strong className="text-[var(--color-forest)]">
                  {formatWindowDay(top.startHour)} {formatHourRange(top.startHour, top.endHour)} (
                  {top.score}/100)
                </strong>
              </>
            )}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className={clsx(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold',
                  selectedDay === day
                    ? 'bg-[var(--color-signal)] text-[var(--color-ink)]'
                    : 'bg-white ring-1 ring-[var(--color-fog)]',
                )}
                onClick={() => setSelectedDay(day)}
              >
                {formatWindowDay(`${day}T12:00`)}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {(dayWindows ?? []).map((w) => (
              <li
                key={`${w.startHour}-${w.endHour}`}
                className="rounded-xl bg-[color-mix(in_oklab,var(--color-mist)_55%,white)] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={clsx(
                      'rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                      scoreClass(w.label),
                    )}
                  >
                    {w.label} · {w.score}
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-forest)]">
                    {formatHourRange(w.startHour, w.endHour)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-stone)]">
                  Viento {w.windSpeedKmh} km/h desde {w.windDirLabel} ({w.relative}) · {w.temperatureC}
                  °C · precip {w.precipitationMm} mm
                </p>
                {w.notes.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-[var(--color-stone)]">{w.notes.join(' · ')}</p>
                )}
              </li>
            ))}
          </ul>

          <p className="text-[10px] text-[var(--color-stone)]">{forecast.attribution}</p>
        </>
      )}
    </section>
  )
}
