import type { Env } from './types'
import { json } from './types'

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
const USER_AGENT = 'PedalMap/1.0 (+https://pedalmap-79b3a.web.app; weather)'

export async function handleWeatherForecast(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const _forecastDays = Math.min(16, Math.max(1, Number(url.searchParams.get('forecast_days') ?? '7')))

  if (!lat || !lng) {
    return json({ error: 'lat and lng required' }, 400)
  }

  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return json({ error: 'invalid coordinates' }, 400)
  }

  const upstreamDays = Math.min(16, Math.max(1, 7))
  const cacheKey = `weather:${latNum.toFixed(2)},${lngNum.toFixed(2)},${upstreamDays}`
  const cached = await caches.default.match(cacheKey)
  if (cached) {
    return cached
  }

  const apiUrl = new URL(OPEN_METEO)
  apiUrl.searchParams.set('latitude', lat)
  apiUrl.searchParams.set('longitude', lng)
  apiUrl.searchParams.set(
    'hourly',
    ['temperature_2m', 'precipitation', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'].join(','),
  )
  apiUrl.searchParams.set('forecast_days', String(upstreamDays))
  apiUrl.searchParams.set('timezone', 'auto')
  apiUrl.searchParams.set('wind_speed_unit', 'kmh')

  let data: {
    latitude?: number
    longitude?: number
    timezone?: string
    hourly?: {
      time?: string[]
      temperature_2m?: number[]
      precipitation?: number[]
      wind_speed_10m?: number[]
      wind_direction_10m?: number[]
      wind_gusts_10m?: number[]
    }
  }

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!res.ok) {
      const reason = `upstream_${res.status}`
      const body = json({ forecast: null, degraded: true, reason }, 200)
      await caches.default.put(cacheKey, body.clone())
      return body
    }

    try {
      data = await res.json()
    } catch {
      const body = json({ forecast: null, degraded: true, reason: 'upstream_invalid_json' }, 200)
      await caches.default.put(cacheKey, body.clone())
      return body
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'upstream_network_error'
    const body = json({ forecast: null, degraded: true, reason }, 200)
    await caches.default.put(cacheKey, body.clone())
    return body
  }

  const times = data.hourly?.time ?? []
  const hours = times.map((time, i) => ({
    time,
    temperatureC: Number(data.hourly?.temperature_2m?.[i] ?? 0),
    precipitationMm: Number(data.hourly?.precipitation?.[i] ?? 0),
    windSpeedKmh: Number(data.hourly?.wind_speed_10m?.[i] ?? 0),
    windDirectionDeg: Number(data.hourly?.wind_direction_10m?.[i] ?? 0),
    windGustsKmh: Number(data.hourly?.wind_gusts_10m?.[i] ?? 0),
  }))

  const forecast = {
    latitude: data.latitude ?? latNum,
    longitude: data.longitude ?? lngNum,
    timezone: data.timezone ?? 'UTC',
    routeBearingDeg: null,
    routeBearingLabel: null,
    hours,
    windows: [],
    attribution: 'Datos: Open-Meteo (CC BY 4.0)',
  }

  const body = json({ forecast }, 200)
  await caches.default.put(cacheKey, body.clone())
  return body
}
