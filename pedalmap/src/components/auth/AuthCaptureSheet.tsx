import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/app/AuthContext'
import { authErrorMessage } from '@/services/AuthService'
import type { PendingAuthKind } from '@/lib/pendingAuthAction'

type Props = {
  open: boolean
  kind: PendingAuthKind
  /** Close after cancel — caller should clear the pending action. */
  onDismiss: () => void
  /** Close after a real session exists — keep pending so the page can auto-save. */
  onAuthenticated: () => void
}

export function AuthCaptureSheet({ open, kind, onDismiss, onAuthenticated }: Props) {
  const {
    user,
    signInGoogle,
    signInEmail,
    registerEmail,
    firebaseReady,
    authError,
    clearAuthError,
  } = useAuth()
  const [mode, setMode] = useState<'google' | 'login' | 'register'>('google')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const visibleError = error || authError
  const onAuthenticatedRef = useRef(onAuthenticated)
  const onDismissRef = useRef(onDismiss)
  onAuthenticatedRef.current = onAuthenticated
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!open) return
    setMode('google')
    setError(null)
    setLoading(false)
    setEmail('')
    setPassword('')
    setName('')
  }, [open])

  useEffect(() => {
    if (!open) return
    if (user && !user.isAnonymous) onAuthenticatedRef.current()
  }, [open, user])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismissRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  async function run(action: () => Promise<void>) {
    setError(null)
    clearAuthError()
    if (!firebaseReady) {
      setError('Firebase no está configurado.')
      return
    }
    setLoading(true)
    try {
      await action()
    } catch (err) {
      console.error('[auth-capture]', err)
      setError(authErrorMessage(err, 'No se pudo completar el acceso. Inténtalo de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'register') {
      void run(() => registerEmail(email, password, name))
      return
    }
    void run(() => signInEmail(email, password))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-capture-title"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md animate-rise rounded-t-3xl bg-white p-5 shadow-2xl safe-pb sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-trail)]">
          Cuenta Free
        </p>
        <h2 id="auth-capture-title" className="mt-2 font-display text-2xl font-extrabold text-[var(--color-forest)]">
          {kind === 'share'
            ? 'Comparte esta ruta con tu cuenta'
            : kind === 'story'
              ? 'Story de esta ruta con tu cuenta'
              : 'Guarda esta ruta en tu cuenta'}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          {kind === 'share'
            ? 'La ruta se queda en esta pantalla. Al entrar, la publicamos para que puedas mandarla por WhatsApp.'
            : kind === 'story'
              ? 'La ruta se queda aquí. Al entrar, preparamos la imagen 9:16 con la silueta, los datos y el enlace. Tú pegas el enlace en la pegatina de Instagram.'
              : 'La ruta se queda en esta pantalla. Al entrar con Google o email la guardamos al instante.'}{' '}
          Seguir calculando y exportar GPX no exige cuenta.
        </p>

        <div className="mt-5 space-y-2">
          <Button
            className="w-full"
            disabled={loading}
            onClick={() => void run(() => signInGoogle())}
          >
            {loading ? 'Un momento…' : 'Continuar con Google'}
          </Button>
          {mode === 'google' ? (
            <Button variant="ghost" className="w-full" disabled={loading} onClick={() => setMode('login')}>
              Usar email
            </Button>
          ) : (
            <form className="space-y-2" onSubmit={onSubmit}>
              {mode === 'register' && (
                <Input
                  placeholder="Nombre"
                  aria-label="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <Input
                type="email"
                required
                placeholder="Email"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Contraseña"
                aria-label="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Un momento…' : mode === 'register' ? 'Crear cuenta y continuar' : 'Entrar y continuar'}
              </Button>
              <p className="text-center text-xs text-[var(--color-stone)]">
                {mode === 'login' ? (
                  <button
                    type="button"
                    className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
                    onClick={() => setMode('register')}
                  >
                    Crear cuenta
                  </button>
                ) : (
                  <button
                    type="button"
                    className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
                    onClick={() => setMode('login')}
                  >
                    Ya tengo cuenta
                  </button>
                )}
              </p>
            </form>
          )}
        </div>

        {visibleError ? (
          <p className="mt-3 text-sm text-[var(--color-danger)]">{visibleError}</p>
        ) : null}

        <div className="mt-4 flex flex-col items-center gap-2">
          <Button variant="ghost" onClick={onDismiss}>
            Ahora no
          </Button>
          <Link
            className="text-xs font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
            to="/login"
          >
            Abrir página de login
          </Link>
        </div>
      </div>
    </div>
  )
}
