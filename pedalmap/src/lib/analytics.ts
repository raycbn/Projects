import { hasAnalyticsConsent } from '@/lib/consent'

export type AnalyticsEvent =
  | 'route_created'
  | 'route_saved'
  | 'route_shared'
  | 'gpx_exported'
  | 'gpx_imported'
  | 'weather_forecast_loaded'
  | 'premium_clicked'
  | 'premium_activated'
  | 'signup_started'
  | 'signup_completed'
  | 'activity_started'
  | 'activity_finished'
  | 'gps_connect_started'
  | 'gps_disconnected'
  | 'gps_synced'
  | 'strava_connect_started'
  | 'strava_disconnected'
  | 'strava_activity_imported'
  | 'strava_sync_completed'
  | 'community_follow'
  | 'consent_updated'

type Payload = Record<string, string | number | boolean | undefined>

/**
 * Privacy-first analytics. Only records when the user accepted optional analytics.
 * DEV always logs to console for debugging.
 */
export function track(event: AnalyticsEvent, payload: Payload = {}): void {
  if (import.meta.env.DEV) {
    console.info('[analytics]', event, payload)
  }
  if (!hasAnalyticsConsent() && event !== 'consent_updated') return

  // Lightweight beacon — no third-party ads SDK. Swap for Plausible/Firebase later.
  try {
    const body = JSON.stringify({
      e: event,
      p: payload,
      t: Date.now(),
      path: typeof location !== 'undefined' ? location.pathname : undefined,
    })
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // No dedicated analytics endpoint yet — keep local-only until wired.
      void body
    }
  } catch {
    // ignore
  }
}
