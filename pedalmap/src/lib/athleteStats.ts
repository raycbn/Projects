import type { Activity, SavedRoute } from '@/domain/types'
import { isoWeekKey } from '@/lib/freemium'

export type PeriodStats = {
  rides: number
  distanceMeters: number
  elevationGainMeters: number
  movingSeconds: number
}

export type HeatDay = {
  date: string
  distanceMeters: number
  rides: number
}

export type MilestoneId =
  | 'first_ride'
  | 'km_100'
  | 'km_500'
  | 'rides_10'
  | 'public_route'
  | 'followers_5'
  | 'gps_connected'

export type Milestone = {
  id: MilestoneId
  label: string
  hint: string
  unlocked: boolean
}

function yearOf(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).getFullYear() : new Date().getFullYear()
}

function dayKey(iso: string): string | null {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function finishedActivities(activities: Activity[]): Activity[] {
  return activities.filter((a) => a.status === 'finished')
}

export function sumPeriodStats(activities: Activity[], predicate: (a: Activity) => boolean): PeriodStats {
  const rows = finishedActivities(activities).filter(predicate)
  return {
    rides: rows.length,
    distanceMeters: rows.reduce((s, a) => s + (a.stats.distanceMeters || 0), 0),
    elevationGainMeters: rows.reduce((s, a) => s + (a.stats.elevationGainMeters || 0), 0),
    movingSeconds: rows.reduce(
      (s, a) => s + (a.stats.movingTimeSeconds ?? a.stats.durationSeconds ?? 0),
      0,
    ),
  }
}

export function sumYearStats(activities: Activity[], year = new Date().getFullYear()): PeriodStats {
  return sumPeriodStats(activities, (a) => yearOf(a.startedAt) === year)
}

export function sumWeekStats(activities: Activity[], week = isoWeekKey()): PeriodStats {
  return sumPeriodStats(activities, (a) => {
    const t = Date.parse(a.startedAt)
    if (!Number.isFinite(t)) return false
    return isoWeekKey(new Date(t)) === week
  })
}

/** Last 52 weeks of daily buckets for a compact heatmap. */
export function buildYearHeatmap(activities: Activity[], year = new Date().getFullYear()): HeatDay[] {
  const map = new Map<string, HeatDay>()
  for (const a of finishedActivities(activities)) {
    if (yearOf(a.startedAt) !== year) continue
    const key = dayKey(a.startedAt)
    if (!key) continue
    const prev = map.get(key) || { date: key, distanceMeters: 0, rides: 0 }
    prev.distanceMeters += a.stats.distanceMeters || 0
    prev.rides += 1
    map.set(key, prev)
  }
  const start = new Date(year, 0, 1)
  const end = year === new Date().getFullYear() ? new Date() : new Date(year, 11, 31)
  const days: HeatDay[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push(map.get(key) || { date: key, distanceMeters: 0, rides: 0 })
  }
  return days
}

export function evaluateMilestones(input: {
  activities: Activity[]
  routes: SavedRoute[]
  followersCount: number
  hasGpsConnection?: boolean
}): Milestone[] {
  const finished = finishedActivities(input.activities)
  const kmTotal = finished.reduce((s, a) => s + (a.stats.distanceMeters || 0), 0) / 1000
  const publicRoutes = input.routes.filter((r) => r.isPublic).length
  return [
    {
      id: 'first_ride',
      label: 'Primera salida',
      hint: 'Registra o importa tu primera rodada',
      unlocked: finished.length >= 1,
    },
    {
      id: 'rides_10',
      label: '10 salidas',
      hint: 'Constancia encima del sillín',
      unlocked: finished.length >= 10,
    },
    {
      id: 'km_100',
      label: '100 km',
      hint: 'Suma 100 km en total',
      unlocked: kmTotal >= 100,
    },
    {
      id: 'km_500',
      label: '500 km',
      hint: 'Medio millar en el cuentakilómetros',
      unlocked: kmTotal >= 500,
    },
    {
      id: 'public_route',
      label: 'Ruta pública',
      hint: 'Publica una ruta en Explorar',
      unlocked: publicRoutes >= 1,
    },
    {
      id: 'followers_5',
      label: '5 seguidores',
      hint: 'Tu comunidad empieza a crecer',
      unlocked: input.followersCount >= 5,
    },
    {
      id: 'gps_connected',
      label: 'GPS conectado',
      hint: 'Vincula Garmin, Wahoo o similar',
      unlocked: Boolean(input.hasGpsConnection),
    },
  ]
}
