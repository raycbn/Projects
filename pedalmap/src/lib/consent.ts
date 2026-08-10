const CONSENT_KEY = 'pedalmap_consent'

export type ConsentValue = 'accepted' | 'rejected'

export function getConsent(): ConsentValue | null {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(CONSENT_KEY)
  if (v === 'accepted' || v === 'rejected') return v
  return null
}

export function setConsent(value: ConsentValue): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CONSENT_KEY, value)
  window.dispatchEvent(new CustomEvent('pedalmap:consent', { detail: value }))
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === 'accepted'
}
