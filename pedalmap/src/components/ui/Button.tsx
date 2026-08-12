import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const styles: Record<Variant, string> = {
  primary: 'bg-[var(--color-signal)] text-[var(--color-ink)] hover:brightness-105 shadow-sm',
  secondary: 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-trail)]',
  ghost:
    'bg-transparent text-[var(--color-forest)] hover:bg-[var(--color-fog)] border border-[var(--color-fog)]',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
}

const sizes: Record<Size, string> = {
  // Soft floor so primary actions stay tappable on phones without blowing dense chips.
  sm: 'min-h-9 px-3 py-2 text-xs',
  md: 'min-h-10 px-4 py-2.5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
