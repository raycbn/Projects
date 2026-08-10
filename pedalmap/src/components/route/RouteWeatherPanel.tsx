import { useEffect, useMemo, useState } from 'react'
import type { RouteDraft } from '@/domain/types'
import {
  weatherService,
  type HourlyWeatherPoint,
  type RideWindowAdvice,
  type RouteWeatherForecast,
} from '@/services/WeatherService'
import { track } from '@/lib/analytics'
import { formatWeatherDay, formatWeatherHour, formatWeatherWindowCaption, meteoDayKey } from '@/lib/weatherFormat'
import clsx from 'clsx'

interface RouteWeatherPanelProps {
  route: RouteDraft
  selectedWindow: RideWindowAdvice | null
  selectedHour: HourlyWeatherPoint | null
  onForecast?: (forecast: RouteWeatherForecast | null) => void
  onSelectWindow: (window: RideWindowAdvice | null) => void
  onSelectHour: (hour: HourlyWeatherPoint | null) => void
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

/** Identity that changes when the user picks another option / geometry. */
function geometryIdentity(route: RouteDraft): string {
  const coords = route.geometry?.coordinates ?? []
  const mid = coords[Math.floor(coords.length / 2)]
  const end = coords[coords.length - 1]
  const opt = route.selectedOptionId ?? ''
  return [
    coords.length,
    Math.round(route.stats?.distanceMeters ?? 0),
    mid?.[0]?.toFixed(5) ?? '',
    mid?.[1]?.toFixed(5) ?? '',
    end?.[0]?.toFixed(5) ?? '',
    end?.[1]?.toFixed(5) ?? '',
    opt,
  ].join(':')
}

export function RouteWeatherPanel({
  route,
  selectedWindow,
  selectedHour,
  onForecast,
  onSelectWindow,
  onSelectHour,
}: RouteWeatherPanelProps) {
  const [forecast, setForecast] = useState<RouteWeatherForecast | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const identity = useMemo(() => geometryIdentity(route), [route])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    onSelectHour(null)
    onSelectWindow(null)
    void weatherService
      .forecastForRoute(route.geometry, { forecastDays: 7, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setForecast(data)
        onForecast?.(data)
        const best = data.windows[0] ?? null
        const day = best ? meteoDayKey(best.startHour) : null
        setSelectedDay(day)
        onSelectWindow(best)
        onSelectHour(null)
        track('weather_forecast_loaded', { windows: data.windows.length, geometryKey: identity })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error('[weather]', err)
        setError('No se pudo cargar el viento/meteo (Open-Meteo).')
        onForecast?.(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity])

  const days = forecast
    ? [...new Set(forecast.windows.map((w) => meteoDayKey(w.startHour)))]
    : []
  const dayWindows = forecast?.windows
    .filter((w) => !selectedDay || meteoDayKey(w.startHour) === selectedDay)
    .sort((a, b) => a.startHour.localeCompare(b.startHour))

  const dayHours = useMemo(() => {
    if (!forecast || !selectedDay) return []
    return forecast.hours.filter((h) => {
      if (meteoDayKey(h.time) !== selectedDay) return false
      const hour = Number(formatWeatherHour(h.time).slice(0, 2))
      return hour >= 6 && hour <= 21
    })
  }, [forecast, selectedDay])

  const top = forecast?.windows[0]

  return (
    <section className="space-y-3 p-2">
      <p className="text-xs text-[var(--color-stone)]">
        El mapa colorea la ruta al cargar el viento (verde cola · azul lateral · naranja cara) y dibuja
        flechas hacia dónde sopla. Toca otra ventana u hora para actualizarlo.
      </p>

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
                  {formatWeatherWindowCaption(top.startHour, top.endHour)} ({top.score}/100)
                </strong>
              </>
            )}
          </p>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
              Día
            </p>
            <div className="flex flex-wrap gap-1.5">
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={clsx(
                    'rounded-lg px-2.5 py-1.5 text-xs font-semibold',
                    selectedDay === day
                      ? 'bg-[var(--color-signal)] text-[var(--color-ink)]'
                      : 'bg-white ring-1 ring-[var(--color-fog)]',
                  )}
                  onClick={() => {
                    setSelectedDay(day)
                    const first =
                      forecast.windows.find((w) => meteoDayKey(w.startHour) === day) ?? null
                    onSelectWindow(first)
                    onSelectHour(null)
                  }}
                >
                  {formatWeatherDay(`${day}T12:00`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
              Hora concreta (mapa)
            </p>
            <div className="flex flex-wrap gap-1">
              {dayHours.map((h) => {
                const active = selectedHour?.time === h.time
                return (
                  <button
                    key={h.time}
                    type="button"
                    className={clsx(
                      'rounded-md px-2 py-1 text-[11px] font-semibold',
                      active
                        ? 'bg-[var(--color-forest)] text-white'
                        : 'bg-white ring-1 ring-[var(--color-fog)] text-[var(--color-forest)]',
                    )}
                    onClick={() => {
                      // Parent clears the window when an hour is set — don't call
                      // onSelectWindow(null) here or it wipes the hour selection.
                      onSelectHour(h)
                    }}
                    title={`${formatWeatherDay(h.time)} · ${Math.round(h.windSpeedKmh)} km/h`}
                  >
                    {formatWeatherHour(h.time)}
                  </button>
                )
              })}
            </div>
          </div>

          <ul className="space-y-2">
            {(dayWindows ?? []).map((w) => {
              const active =
                !selectedHour &&
                selectedWindow?.startHour === w.startHour &&
                selectedWindow?.endHour === w.endHour
              return (
                <li key={`${w.startHour}-${w.endHour}`}>
                  <button
                    type="button"
                    className={clsx(
                      'w-full rounded-xl px-3 py-2 text-left',
                      active
                        ? 'bg-[color-mix(in_oklab,var(--color-signal)_28%,white)] ring-2 ring-[var(--color-signal)]'
                        : 'bg-[color-mix(in_oklab,var(--color-mist)_55%,white)] ring-1 ring-transparent',
                    )}
                    onClick={() => {
                      onSelectWindow(w)
                      onSelectHour(null)
                    }}
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
                        {formatWeatherWindowCaption(w.startHour, w.endHour)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-stone)]">
                      Viento {w.windSpeedKmh} km/h desde {w.windDirLabel} ({w.relative}) ·{' '}
                      {w.temperatureC}°C · precip {w.precipitationMm} mm
                    </p>
                    {w.notes.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-[var(--color-stone)]">
                        {w.notes.join(' · ')}
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          <p className="text-[10px] text-[var(--color-stone)]">{forecast.attribution}</p>
        </>
      )}
    </section>
  )
}
