import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const styles: Record<Variant, string> = {
  primary:
    'bg-[var(--color-signal)] text-[var(--color-ink)] hover:brightness-105 shadow-[0_10px_30px_rgba(214,255,75,0.25)]',
  secondary:
    'bg-[var(--color-forest)] text-white hover:bg-[var(--color-trail)]',
  ghost:
    'bg-transparent text-[var(--color-forest)] hover:bg-[var(--color-fog)] border border-[var(--color-fog)]',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
