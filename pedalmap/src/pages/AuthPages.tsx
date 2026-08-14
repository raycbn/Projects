import { Navigate } from 'react-router-dom'
import { AuthForm } from '@/components/auth/AuthForm'
import { useAuth } from '@/app/AuthContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { postLoginPath } from '@/lib/pendingAuthAction'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4 py-10">
        <p className="text-sm text-[var(--color-stone)]">Comprobando sesión…</p>
      </main>
    )
  }
  if (user && !user.isAnonymous) {
    return <Navigate to={postLoginPath()} replace />
  }
  return <>{children}</>
}

export function LoginPage() {
  usePageMeta({
    title: 'Entrar | PedalMap',
    description: 'Accede a PedalMap para guardar y sincronizar tus rutas ciclistas.',
    path: '/login',
    noindex: true,
  })
  return (
    <AuthGate>
      <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-10">
        <AuthForm mode="login" />
      </main>
    </AuthGate>
  )
}

export function RegisterPage() {
  usePageMeta({
    title: 'Crear cuenta | PedalMap',
    description: 'Crea tu cuenta gratuita en PedalMap y guarda tus rutas.',
    path: '/register',
    noindex: true,
  })
  return (
    <AuthGate>
      <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-10">
        <AuthForm mode="register" />
      </main>
    </AuthGate>
  )
}

export function ForgotPasswordPage() {
  usePageMeta({
    title: 'Recuperar contraseña | PedalMap',
    description: 'Restablece el acceso a tu cuenta de PedalMap.',
    path: '/forgot-password',
    noindex: true,
  })
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-10">
      <AuthForm mode="forgot" />
    </main>
  )
}
