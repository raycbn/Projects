import { Link } from 'react-router-dom'
import clsx from 'clsx'

type BrandLogoProps = {
  className?: string
  /** Header / compact vs landing emphasis */
  size?: 'sm' | 'md' | 'lg'
  to?: string | null
}

const heights = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14 md:h-16',
} as const

/** Official PedalMap horizontal lockup (wheel + wordmark). */
export function BrandLogo({ className, size = 'md', to = '/' }: BrandLogoProps) {
  const img = (
    <img
      src="/brand/logo-horizontal.png"
      alt="PedalMap"
      className={clsx('w-auto object-contain object-left', heights[size], className)}
      decoding="async"
    />
  )
  if (to === null) return img
  return (
    <Link to={to} className="inline-flex items-center" aria-label="PedalMap inicio">
      {img}
    </Link>
  )
}
