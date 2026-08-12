import type { ThumbPoint } from '@/lib/routeThumb'
import { pointsToSvgPath } from '@/lib/routeThumb'

type Props = {
  points: ThumbPoint[]
  className?: string
  stroke?: string
  width?: number
  height?: number
  title?: string
}

/** Tiny route silhouette — lists and covers. No MapLibre. */
export function RouteThumb({
  points,
  className = '',
  stroke = 'var(--color-trail)',
  width = 120,
  height = 64,
  title = 'Trazado',
}: Props) {
  const path = pointsToSvgPath(points, width, height)
  if (!path) return null
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={title}
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
