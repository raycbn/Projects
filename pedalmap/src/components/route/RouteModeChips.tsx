import type { ReactElement } from 'react'
import type { RouteType } from '@/domain/types'
import clsx from 'clsx'

interface ModeOption {
  id: RouteType
  label: string
  icon: (props: { className?: string }) => ReactElement
}

function IconAToB({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="5" cy="19" r="2.25" fill="currentColor" />
      <circle cx="19" cy="5" r="2.25" fill="currentColor" />
      <path
        d="M6.8 17.4 17.4 6.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="2.4 2.4"
      />
    </svg>
  )
}

function IconOutAndBack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 12h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M11 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12h-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 16l4-4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    </svg>
  )
}

function IconCircular({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 4a8 8 0 1 1-6.32 3.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4.5 3.5v4.2h4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconTrace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 17.5 8.2 15c1.6-.95 3.1.6 4.6-.35L20 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m16.3 5.7 2 2-8.9 8.9-2.6.6.6-2.6z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  )
}

const MODE_OPTIONS: ModeOption[] = [
  { id: 'a_to_b', label: 'A → B', icon: IconAToB },
  { id: 'out_and_back', label: 'Ida y vuelta', icon: IconOutAndBack },
  { id: 'circular', label: 'Objetivo', icon: IconCircular },
  { id: 'map_trace', label: 'Trazar', icon: IconTrace },
]

interface RouteModeChipsProps {
  value: RouteType
  onChange: (value: RouteType) => void
}

export function RouteModeChips({ value, onChange }: RouteModeChipsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de ruta"
      className="grid grid-cols-4 gap-1.5 rounded-2xl bg-[var(--color-mist)] p-1.5 ring-1 ring-[var(--color-fog)]"
    >
      {MODE_OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            className={clsx(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold leading-tight transition',
              active
                ? 'bg-[var(--color-signal)] text-[var(--color-ink)] shadow-sm'
                : 'text-[var(--color-forest)] active:bg-white',
            )}
            onClick={() => onChange(id)}
          >
            <Icon className="size-4" />
            <span className="text-center text-balance">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
