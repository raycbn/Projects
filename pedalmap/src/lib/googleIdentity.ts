/**
 * Google Identity Services — obtain an access token without Firebase redirect helpers.
 * Avoids /__/auth + third-party storage issues on custom domains.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            prompt?: string
            callback: (response: {
              access_token?: string
              error?: string
              error_description?: string
            }) => void
            error_callback?: (error: { type?: string; message?: string }) => void
          }) => { requestAccessToken: (override?: { prompt?: string }) => void }
        }
      }
    }
  }
}

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'

/** Firebase-managed Web client ID (Google IdP for the PedalMap project). */
export function googleOAuthClientId(): string {
  return String(
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '1024592974606-tiq9ipsv4est4he707q04qroksef47tv.apps.googleusercontent.com',
  )
}

let gisLoading: Promise<void> | null = null

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoading) return gisLoading
  gisLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity')))
      if (window.google?.accounts?.oauth2) resolve()
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity'))
    document.head.appendChild(script)
  })
  return gisLoading
}

/**
 * Opens Google account picker and returns an OAuth access token.
 * Must be called from a user gesture (button click).
 */
export async function requestGoogleAccessToken(): Promise<string> {
  await loadGoogleIdentityScript()
  const clientId = googleOAuthClientId()
  if (!clientId) throw new Error('Falta VITE_GOOGLE_CLIENT_ID')

  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2
    if (!oauth2) {
      reject(new Error('Google Identity no está disponible'))
      return
    }
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      prompt: 'select_account',
      callback: (response) => {
        if (response.error) {
          reject(
            Object.assign(new Error(response.error_description || response.error), {
              code:
                response.error === 'access_denied' || response.error === 'popup_closed'
                  ? 'auth/popup-closed-by-user'
                  : 'auth/google-gis',
            }),
          )
          return
        }
        if (!response.access_token) {
          reject(new Error('Google no devolvió access_token'))
          return
        }
        resolve(response.access_token)
      },
      error_callback: (error) => {
        const message = error?.message || error?.type || 'Inicio con Google cancelado'
        reject(
          Object.assign(new Error(message), {
            code:
              error?.type === 'popup_closed' || error?.type === 'popup_failed'
                ? 'auth/popup-closed-by-user'
                : 'auth/google-gis',
          }),
        )
      },
    })
    client.requestAccessToken()
  })
}
