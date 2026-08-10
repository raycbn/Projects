import { useEffect, useId, useState } from 'react'
import type { LatLng, PlaceSuggestion } from '@/domain/types'
import { createGeocodingProvider } from '@/adapters/geocoding/createGeocodingProvider'
import { Input } from '@/components/ui/Input'

interface SearchLocationProps {
  label: string
  placeholder: string
  valueLabel?: string
  onSelect: (place: PlaceSuggestion) => void
  proximity?: LatLng
}

const geocoder = createGeocodingProvider()

export function SearchLocation({
  label,
  placeholder,
  valueLabel,
  onSelect,
  proximity,
}: SearchLocationProps) {
  const listId = useId()
  const [query, setQuery] = useState(valueLabel ?? '')
  const [results, setResults] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(valueLabel ?? null)

  useEffect(() => {
    if (valueLabel !== undefined) {
      setQuery(valueLabel)
      setSelectedLabel(valueLabel)
    }
  }, [valueLabel])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    // Avoid re-opening suggestions right after a successful pick.
    if (selectedLabel && query === selectedLabel) {
      setResults([])
      setOpen(false)
      return
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const items = await geocoder.search(query, { proximity, limit: 5 })
          setResults(items)
          setOpen(true)
        } catch (error) {
          console.error('[geocode]', error)
          setResults([])
        } finally {
          setLoading(false)
        }
      })()
    }, 350)

    return () => window.clearTimeout(handle)
  }, [query, proximity, selectedLabel])

  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        {label}
      </label>
      <Input
        value={query}
        placeholder={placeholder}
        aria-label={label}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        onChange={(e) => {
          setSelectedLabel(null)
          setQuery(e.target.value)
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {loading && (
        <p className="mt-1 text-xs text-[var(--color-stone)] animate-pulse-soft">Buscando…</p>
      )}
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[var(--color-fog)] bg-white py-1 shadow-lg"
        >
          {results.map((item) => (
            <li key={item.id} role="option">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-mist)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelectedLabel(item.label)
                  setQuery(item.label)
                  setOpen(false)
                  setResults([])
                  onSelect(item)
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
