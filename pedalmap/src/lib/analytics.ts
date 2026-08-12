import { hasAnalyticsConsent } from '@/lib/consent'

export type AnalyticsEvent =
  | 'route_created'
  | 'route_saved'
  | 'route_shared'
  | 'gpx_exported'
  | 'gpx_imported'
  | 'weather_forecast_loaded'
  | 'paywall_shown'
  | 'premium_clicked'
  | 'premium_activated'
  | 'signup_started'
  | 'signup_completed'
  | 'activity_started'
  | 'activity_finished'
  | 'activity_shared'
  | 'gps_connect_started'
  | 'gps_disconnected'
  | 'gps_synced'
  | 'strava_connect_started'
  | 'strava_disconnected'
  | 'strava_activity_imported'
  | 'strava_sync_completed'
  | 'free_trial_used'
  | 'wind_alert_opt_in'
  | 'wind_alert_shown'
  | 'community_follow'
  | 'consent_updated'
  | 'page_view'

type Payload = Record<string, string | number | boolean | undefined>

const PLAUSIBLE_DOMAIN = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined)?.trim()
const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim()

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

let loaded = false

/** Inject Plausible and/or GA4 only after analytics consent. */
export function ensureAnalyticsLoaded(): void {
  if (loaded || typeof document === 'undefined') return
  if (!hasAnalyticsConsent()) return
  loaded = true

  if (PLAUSIBLE_DOMAIN) {
    const s = document.createElement('script')
    s.defer = true
    s.dataset.domain = PLAUSIBLE_DOMAIN
    s.src = 'https://plausible.io/js/script.js'
    document.head.appendChild(s)
  }

  if (GA_ID) {
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
    document.head.appendChild(s)
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args)
    }
    window.gtag('js', new Date())
    window.gtag('config', GA_ID, { anonymize_ip: true })
  }
}

export function trackPageview(path: string): void {
  if (!hasAnalyticsConsent()) return
  ensureAnalyticsLoaded()
  try {
    window.plausible?.('pageview')
    if (GA_ID && window.gtag) {
      window.gtag('event', 'page_view', { page_path: path })
    }
  } catch {
    // ignore
  }
}

/**
 * Privacy-first analytics. Only records when the user accepted optional analytics.
 * DEV always logs to console for debugging.
 */
export function track(event: AnalyticsEvent, payload: Payload = {}): void {
  if (import.meta.env.DEV) {
    console.info('[analytics]', event, payload)
  }
  if (!hasAnalyticsConsent() && event !== 'consent_updated') return

  ensureAnalyticsLoaded()

  try {
    const props: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined) props[k] = v
    }
    window.plausible?.(event, Object.keys(props).length ? { props } : undefined)
    if (GA_ID && window.gtag) {
      window.gtag('event', event, props)
    }
  } catch {
    // ignore
  }
}
