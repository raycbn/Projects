import type { RouteAlternative } from '@/domain/types'

/** Free can fully use the top 2 ranked options; 3rd+ is Premium upsell. */
export const FREE_SELECTABLE_ROUTE_OPTIONS = 2

export function routeOptionRank(opt: RouteAlternative, index = 0): number {
  return opt.rank ?? index + 1
}

/** True when Free must see the option locked (still visible with stats). */
export function isRouteOptionPremiumLocked(
  opt: RouteAlternative,
  isPremium: boolean,
  index = 0,
): boolean {
  if (isPremium) return false
  return routeOptionRank(opt, index) > FREE_SELECTABLE_ROUTE_OPTIONS
}
