import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { hasAnalyticsConsent } from '@/lib/consent'
import { trackPageview, ensureAnalyticsLoaded } from '@/lib/analytics'

/** Loads optional analytics after consent and records SPA pageviews. */
export function AnalyticsListener() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    function onConsent() {
      if (hasAnalyticsConsent()) ensureAnalyticsLoaded()
    }
    onConsent()
    window.addEventListener('pedalmap:consent', onConsent)
    return () => window.removeEventListener('pedalmap:consent', onConsent)
  }, [])

  useEffect(() => {
    if (!hasAnalyticsConsent()) return
    ensureAnalyticsLoaded()
    trackPageview(pathname + search)
  }, [pathname, search])

  return null
}
