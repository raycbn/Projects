export type AnalyticsEvent =
  | 'route_created'
  | 'route_saved'
  | 'route_shared'
  | 'gpx_exported'
  | 'gpx_imported'
  | 'weather_forecast_loaded'
  | 'premium_clicked'
  | 'signup_started'
  | 'signup_completed'
  | 'activity_started'
  | 'activity_finished'
  | 'community_follow'

type Payload = Record<string, string | number | boolean | undefined>

/**
 * Privacy-first analytics stub.
 * Does not send PII. Wire to Firebase Analytics / Plausible later after consent.
 */
export function track(event: AnalyticsEvent, payload: Payload = {}): void {
  if (import.meta.env.DEV) {
    console.info('[analytics]', event, payload)
  }
  // Future: window.gtag / Firebase Analytics / Plausible — only with consent.
}
