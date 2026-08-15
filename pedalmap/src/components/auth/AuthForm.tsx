import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/app/AuthContext'
import { authErrorMessage } from '@/services/AuthService'
import { clearPendingAuthAction, postLoginPath } from '@/lib/pendingAuthAction'
import { markSorteoSignup } from '@/lib/sorteoSignup'

type Mode = 'login' | 'register' | 'forgot'

interface AuthFormProps {
  mode: Mode
}

export function AuthForm({ mode }: AuthFormProps) {
  const {
    signInEmail,
    registerEmail,
    signInGoogle,
    signInGuest,
    resetPassword,
    firebaseReady,
    authError,
    clearAuthError,
  } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fromSorteo = mode === 'register' && params.get('from') === 'sorteo'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (fromSorteo) markSorteoSignup()
  }, [fromSorteo])

  const visibleError = error || authError

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    clearAuthError()
    setMessage(null)
    if (!firebaseReady) {
      setError('Firebase no está configurado. Copia .env.example a .env y completa las claves.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInEmail(email, password)
        navigate(postLoginPath(), { replace: true })
      } else if (mode === 'register') {
        await registerEmail(email, password, name)
        navigate(postLoginPath(), { replace: true })
      } else {
        await resetPassword(email)
        setMessage('Te hemos enviado un enlace para restablecer la contraseña.')
      }
    } catch (err) {
      console.error('[auth]', err)
      setError(authErrorMessage(err, 'No hemos podido completar la operación. Revisa tus datos e inténtalo de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl bg-white/85 p-6 shadow-lg ring-1 ring-[var(--color-fog)]">
      <h1 className="font-display text-3xl font-800 text-[var(--color-forest)]">
        {mode === 'login' && 'Entrar'}
        {mode === 'register' && 'Crear cuenta'}
        {mode === 'forgot' && 'Recuperar contraseña'}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-stone)]">
        {fromSorteo
          ? 'Cuenta nueva con email (Google o correo). El invitado no entra en el cupo Premium.'
          : 'Puedes planificar rutas sin cuenta. Regístrate cuando quieras guardar o sincronizar.'}
      </p>

      <form className="mt-6 space-y-3" onSubmit={(e) => void onSubmit(e)}>
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
        {mode !== 'forgot' && (
          <Input
            type="password"
            required
            minLength={6}
            placeholder="Contraseña"
            aria-label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {visibleError && <p className="text-sm text-[var(--color-danger)]">{visibleError}</p>}
        {message && <p className="text-sm text-[var(--color-trail)]">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Un momento…' : mode === 'forgot' ? 'Enviar enlace' : 'Continuar'}
        </Button>
      </form>

      {mode !== 'forgot' && (
        <div className="mt-4 space-y-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={loading}
            onClick={() => {
              setError(null)
              clearAuthError()
              if (fromSorteo) markSorteoSignup()
              setLoading(true)
              void signInGoogle()
                .catch((err) => {
                  console.error(err)
                  setError(authErrorMessage(err, 'No se pudo iniciar sesión con Google.'))
                })
                .finally(() => setLoading(false))
            }}
          >
            Continuar con Google
          </Button>
          {fromSorteo ? null : (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={loading}
            onClick={() => {
              setError(null)
              clearAuthError()
              setLoading(true)
              void signInGuest()
                .then(() => {
                  clearPendingAuthAction()
                  navigate('/route-planner', { replace: true })
                })
                .catch((err) => {
                  console.error(err)
                  setError(authErrorMessage(err, 'No se pudo entrar como invitado.'))
                })
                .finally(() => setLoading(false))
            }}
          >
            Seguir como invitado
          </Button>
          )}
        </div>
      )}

      <div className="mt-4 space-y-1 text-sm text-[var(--color-stone)]">
        {mode === 'login' && (
          <>
            <p>
              ¿No tienes cuenta? <Link className="text-[var(--color-trail)] underline" to="/register">Regístrate</Link>
            </p>
            <p>
              <Link className="text-[var(--color-trail)] underline" to="/forgot-password">
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
          </>
        )}
        {mode === 'register' && (
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link className="text-[var(--color-trail)] underline" to="/login">
              Entrar
            </Link>
            {fromSorteo ? ' · Esta promo es solo para cuentas nuevas.' : null}
          </p>
        )}
        {mode === 'forgot' && (
          <p>
            <Link className="text-[var(--color-trail)] underline" to="/login">Volver a entrar</Link>
          </p>
        )}
      </div>
    </div>
  )
}
