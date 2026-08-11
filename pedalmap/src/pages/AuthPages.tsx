import { Navigate } from 'react-router-dom'
import { AuthForm } from '@/components/auth/AuthForm'
import { useAuth } from '@/app/AuthContext'
import { usePageMeta } from '@/hooks/usePageMeta'

export function LoginPage() {
  usePageMeta({
    title: 'Entrar | PedalMap',
    description: 'Accede a PedalMap para guardar y sincronizar tus rutas ciclistas.',
    path: '/login',
    noindex: true,
  })
  const { user } = useAuth()
  if (user && !user.isAnonymous) return <Navigate to="/my-routes" replace />
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-10">
      <AuthForm mode="login" />
    </main>
  )
}

export function RegisterPage() {
  usePageMeta({
    title: 'Crear cuenta | PedalMap',
    description: 'Crea tu cuenta gratuita en PedalMap y guarda tus rutas.',
    path: '/register',
    noindex: true,
  })
  const { user } = useAuth()
  if (user && !user.isAnonymous) return <Navigate to="/my-routes" replace />
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-10">
      <AuthForm mode="register" />
    </main>
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
