import type { SurfaceStats } from '@/domain/types'

/** ORS surface value IDs → Spanish labels (official ORS surface table). */
export const ORS_SURFACE_LABELS: Record<number, string> = {
  0: 'Desconocido',
  1: 'Pavimentado',
  2: 'Sin pavimentar',
  3: 'Asfalto',
  4: 'Hormigón',
  5: 'Adoquines',
  6: 'Metal',
  7: 'Madera',
  8: 'Grava compacta',
  9: 'Grava fina',
  10: 'Grava',
  11: 'Tierra',
  12: 'Suelo / barro',
  13: 'Hielo / nieve',
  14: 'Losas',
  15: 'Arena',
  16: 'Astillas',
  17: 'Hierba',
  18: 'Hierba con adoquín',
}

/** ORS waytype value IDs → Spanish labels. */
export const ORS_WAYTYPE_LABELS: Record<number, string> = {
  0: 'Desconocido',
  1: 'Vía principal',
  2: 'Carretera',
  3: 'Calle',
  4: 'Sendero',
  5: 'Pista',
  6: 'Carril bici',
  7: 'Peatonal',
  8: 'Escaleras',
  9: 'Ferry',
  10: 'Obras',
}

const PAVED_SURFACE_IDS = new Set([1, 3, 4, 5, 14, 18])
const UNPAVED_SURFACE_IDS = new Set([2, 8, 9, 10, 11, 12, 15, 16, 17])

export interface OrsExtraSummaryRow {
  value: number
  distance: number
  amount: number
}

export interface OrsExtraBlock {
  values?: number[][]
  summary?: OrsExtraSummaryRow[]
}

export interface OrsExtras {
  surface?: OrsExtraBlock
  waytype?: OrsExtraBlock
  waytypes?: OrsExtraBlock
}

export function surfaceLabel(id: number): string {
  return ORS_SURFACE_LABELS[id] ?? `Superficie ${id}`
}

export function waytypeLabel(id: number): string {
  return ORS_WAYTYPE_LABELS[id] ?? `Tipo ${id}`
}

/**
 * Build Strava-like surface stats from ORS extras.surface.summary.
 * Amounts are percentages; distances are meters.
 */
export function surfaceStatsFromOrsExtras(extras: OrsExtras | undefined): SurfaceStats | undefined {
  const summary = extras?.surface?.summary
  if (!summary?.length) return undefined

  let paved = 0
  let unpaved = 0
  let unknown = 0
  const surfaces = summary
    .map((row) => ({
      type: surfaceLabel(row.value),
      distanceMeters: row.distance,
      amount: row.amount,
      value: row.value,
    }))
    .sort((a, b) => b.distanceMeters - a.distanceMeters)

  for (const row of summary) {
    if (PAVED_SURFACE_IDS.has(row.value)) paved += row.amount
    else if (UNPAVED_SURFACE_IDS.has(row.value)) unpaved += row.amount
    else unknown += row.amount
  }

  return {
    pavedPercent: Math.round(paved * 10) / 10,
    unpavedPercent: Math.round(unpaved * 10) / 10,
    unknownPercent: Math.round(unknown * 10) / 10,
    surfaces: surfaces.map(({ type, distanceMeters }) => ({ type, distanceMeters })),
  }
}

export function waytypeBreakdownFromOrsExtras(
  extras: OrsExtras | undefined,
): Array<{ type: string; distanceMeters: number; percent: number }> | undefined {
  const block = extras?.waytype ?? extras?.waytypes
  const summary = block?.summary
  if (!summary?.length) return undefined
  return summary
    .map((row) => ({
      type: waytypeLabel(row.value),
      distanceMeters: row.distance,
      percent: Math.round(row.amount * 10) / 10,
    }))
    .sort((a, b) => b.distanceMeters - a.distanceMeters)
}
