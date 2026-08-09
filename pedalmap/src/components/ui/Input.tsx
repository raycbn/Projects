import clsx from 'clsx'
import type { InputHTMLAttributes } from 'react'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-xl border border-[var(--color-fog)] bg-white/90 px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-stone)] shadow-sm focus:border-[var(--color-trail)] focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}
