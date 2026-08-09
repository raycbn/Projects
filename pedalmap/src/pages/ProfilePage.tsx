import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'

export function ProfilePage() {
  usePageMeta({
    title: 'Perfil | PedalMap',
    description: 'Gestiona tu cuenta y preferencias de ciclismo en PedalMap.',
    path: '/perfil',
  })
  const { user, profile, logout } = useAuth()

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 pb-24">
      <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Perfil</h1>
      {!user ? (
        <div className="mt-4">
          <p className="text-[var(--color-stone)]">Aún no has iniciado sesión.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Entrar</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
          <p>
            <span className="text-sm text-[var(--color-stone)]">Nombre</span>
            <br />
            <strong>{profile?.displayName || (user.isAnonymous ? 'Invitado' : 'Ciclista')}</strong>
          </p>
          <p>
            <span className="text-sm text-[var(--color-stone)]">Email</span>
            <br />
            <strong>{profile?.email || '—'}</strong>
          </p>
          <p>
            <span className="text-sm text-[var(--color-stone)]">Plan</span>
            <br />
            <strong className="capitalize">{profile?.plan || 'free'}</strong>
          </p>
          <p>
            <span className="text-sm text-[var(--color-stone)]">Bici preferida</span>
            <br />
            <strong>{profile?.bikePreferences.bikeType || 'road'}</strong>
          </p>
          <Button variant="ghost" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      )}
    </main>
  )
}
