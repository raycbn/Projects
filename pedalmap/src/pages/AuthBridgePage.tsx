import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  attachCustomTokenHash,
  isAllowedAuthReturnUrl,
  mintCustomTokenFromIdToken,
} from '@/lib/authBridge'
import { authErrorMessage, authService } from '@/services/AuthService'
import { getFirebaseAuth } from '@/lib/firebase'

/**
 * Runs on the Firebase Hosting host (*.web.app) where Google redirect works.
 * After sign-in, mints a custom token and sends the user back to pedalmap.es.
 */
export function AuthBridgePage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('Conectando con Google…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function finishWithUser(): Promise<boolean> {
      const user = getFirebaseAuth().currentUser
      if (!user || user.isAnonymous) return false
      setStatus('Creando sesión…')
      const idToken = await user.getIdToken()
      const customToken = await mintCustomTokenFromIdToken(idToken)
      const returnTo =
        isAllowedAuthReturnUrl(params.get('return')) || 'https://pedalmap.es/login'
      window.location.replace(attachCustomTokenHash(returnTo, customToken))
      return true
    }

    async function run() {
      try {
        await authService.completeGoogleRedirect()
        if (cancelled) return
        if (await finishWithUser()) return

        setStatus('Redirigiendo a Google…')
        // Direct Google flow on this host (authDomain matches — no nested bridge).
        await authService.signInGoogleDirect()
        if (cancelled) return
        if (await finishWithUser()) return
      } catch (err) {
        console.error('[auth-bridge]', err)
        if (!cancelled) {
          setError(authErrorMessage(err, 'No se pudo completar el inicio con Google.'))
          setStatus('Error')
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [params])

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-10 text-center">
      <p className="font-display text-2xl font-bold text-[var(--color-forest)]">PedalMap</p>
      <p className="mt-4 text-[var(--color-stone)]">{status}</p>
      {error && (
        <p className="mt-4 text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      {error && (
        <a
          className="mt-6 text-sm font-semibold text-[var(--color-trail)] underline"
          href="https://pedalmap.es/login"
        >
          Volver a entrar
        </a>
      )}
    </main>
  )
}
