import { useEffect } from 'react'

/** Injects (or replaces) a JSON-LD script tag for GEO / rich results. */
export function useJsonLd(id: string, data: object | object[]) {
  const serialized = JSON.stringify(data)
  useEffect(() => {
    const scriptId = `jsonld-${id}`
    let el = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!el) {
      el = document.createElement('script')
      el.type = 'application/ld+json'
      el.id = scriptId
      document.head.appendChild(el)
    }
    el.textContent = serialized
    return () => {
      el?.remove()
    }
  }, [id, serialized])
}
