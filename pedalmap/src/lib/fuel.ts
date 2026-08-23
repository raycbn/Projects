const FUEL_BASE_URL = 'https://fuel.pedalmap.es/planner'

export interface FuelRouteContext {
  distanceKm: number
  durationMinutes: number
  elevationGainM?: number
  temperatureC?: number
  intensity?: string
  goal?: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value)
}

export function buildFuelUrl(context: FuelRouteContext): string {
  const params = new URLSearchParams()

  params.set('source', 'pedalmap')
  params.set('sport', 'cycling')

  if (!isFiniteNumber(context.distanceKm) || context.distanceKm < 0) {
    throw new Error('distanceKm must be a finite non-negative number')
  }
  params.set('distanceKm', String(Math.round(context.distanceKm * 10) / 10))

  if (!isFiniteNumber(context.durationMinutes) || context.durationMinutes <= 0) {
    throw new Error('durationMinutes must be a finite positive number')
  }
  params.set('durationMinutes', String(Math.round(context.durationMinutes)))

  if (isFiniteNumber(context.elevationGainM) && context.elevationGainM >= 0) {
    params.set('elevationGainM', String(Math.round(context.elevationGainM)))
  }

  if (isFiniteNumber(context.temperatureC)) {
    params.set('temperatureC', String(Math.round(context.temperatureC)))
  }

  if (typeof context.intensity === 'string' && context.intensity.trim().length > 0) {
    params.set('intensity', context.intensity.trim())
  }

  if (typeof context.goal === 'string' && context.goal.trim().length > 0) {
    params.set('goal', context.goal.trim())
  }

  return `${FUEL_BASE_URL}?${params.toString()}`
}

export function canShowFuelCta(context: Partial<FuelRouteContext>): boolean {
  return (
    isFiniteNumber(context.distanceKm) &&
    context.distanceKm >= 0 &&
    isFiniteNumber(context.durationMinutes) &&
    context.durationMinutes > 0
  )
}
