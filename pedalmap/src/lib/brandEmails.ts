/**
 * Public PedalMap inboxes on pedalmap.es.
 * Never put personal Gmail addresses in product UI, legal copy, or committed Worker vars.
 */
export const BRAND_EMAILS = {
  /** General / marketing contact */
  hello: 'hola@pedalmap.es',
  /** Support, privacy & rights requests */
  support: 'soporte@pedalmap.es',
  /** Transactional mail (no reply expected) */
  noreply: 'noreply@pedalmap.es',
  /** Premium / billing replies */
  premium: 'premium@pedalmap.es',
  /** Wind / product alerts */
  alerts: 'aviso@pedalmap.es',
} as const

/** Default legal & in-app contact shown to users. */
export const PUBLIC_CONTACT_EMAIL = BRAND_EMAILS.support
