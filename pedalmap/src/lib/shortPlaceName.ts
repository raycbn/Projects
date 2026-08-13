/**
 * Shorten a Nominatim/Photon display_name for route titles.
 * Search UI keeps the full label; titles use this compact form.
 */
export function shortPlaceNameForTitle(raw: string | null | undefined): string {
  const input = (raw ?? '').trim()
  if (!input) return 'Lugar'

  if (/^estoy aqu[ií]/i.test(input)) return 'Estoy aquí'

  const parts = input
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length <= 1) return clampName(parts[0] || input)

  const kept = parts.filter((p) => !isNoisePart(p))
  const candidate = kept[0] || parts[0]
  return clampName(candidate)
}

function isNoisePart(part: string): boolean {
  const p = part.trim()
  if (!p) return true
  // Postal codes (Spain 5 digits; also allow bare house numbers)
  if (/^\d{4,6}([-\s]?\d{0,4})?$/i.test(p)) return true
  if (/^(españa|spain|es)$/i.test(p)) return true
  if (/^(comunidad( aut[oó]noma)? de)\b/i.test(p)) return true
  if (/^(provincia de|region of|autonomous community)\b/i.test(p)) return true
  // Street lines: "Calle X", "19", "C/ …"
  if (/^(calle|c\/|avenida|avda\.?|av\.|plaza|paseo|camino|carretera|ronda|traves[ií]a|urb\.|urbanizaci[oó]n)\b/i.test(p)) {
    return true
  }
  // Pure street number with optional letter: "19", "12B"
  if (/^\d+[A-Za-z]?$/i.test(p)) return true
  return false
}

function clampName(name: string): string {
  const n = name.trim()
  if (n.length <= 48) return n
  return `${n.slice(0, 45).trimEnd()}…`
}
