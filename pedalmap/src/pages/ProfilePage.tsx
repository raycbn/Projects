import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { BikeSelector } from '@/components/route/BikeSelector'
import { RoutePreferencesPanel } from '@/components/route/RoutePreferences'
import { usePageMeta } from '@/hooks/usePageMeta'
import type { BikeType, RoutePreference } from '@/domain/types'

export function ProfilePage() {
  usePageMeta({
    title: 'Perfil | PedalMap',
    description: 'Gestiona tu cuenta y preferencias de ciclismo en PedalMap.',
    path: '/perfil',
  })
  const { user, profile, logout, updateBikePreferences } = useAuth()
  const [bikeType, setBikeType] = useState<BikeType>(profile?.bikePreferences.bikeType ?? 'road')
  const [preferences, setPreferences] = useState<RoutePreference[]>(
    profile?.bikePreferences.preferences ?? [],
  )
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setBikeType(profile.bikePreferences.bikeType)
    setPreferences(profile.bikePreferences.preferences)
  }, [profile])

  async function handleSavePrefs() {
    setSaving(true)
    setMessage(null)
    try {
      await updateBikePreferences({ bikeType, preferences })
      setMessage('Preferencias guardadas. Se usarán al abrir el planificador.')
    } catch (error) {
      console.error('[profile]', error)
      setMessage('No se pudieron guardar las preferencias.')
    } finally {
      setSaving(false)
    }
  }

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
        <div className="mt-6 space-y-5">
          <div className="space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
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
          </div>

          <div className="space-y-4 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
            <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
              Perfil ciclista
            </h2>
            <BikeSelector value={bikeType} onChange={setBikeType} />
            <RoutePreferencesPanel
              value={preferences}
              onChange={setPreferences}
              profile={profile}
              onLimitReached={() =>
                setMessage(
                  `Free permite hasta 2 filtros a la vez. Quita uno o pasa a Premium.`,
                )
              }
            />
            <Button disabled={saving} onClick={() => void handleSavePrefs()}>
              {saving ? 'Guardando…' : 'Guardar preferencias'}
            </Button>
            {message && <p className="text-sm text-[var(--color-trail)]">{message}</p>}
          </div>

          <div className="space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
            <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Atajos</h2>
            <div className="flex flex-col gap-2 text-sm">
              <Link
                to="/actividades/conectar"
                className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
              >
                Conectar GPS
              </Link>
              <Link
                to="/premium"
                className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
              >
                Premium
              </Link>
              <Link
                to="/ruta"
                className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
              >
                Última ruta lista
              </Link>
            </div>
          </div>

          <Button variant="ghost" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      )}
    </main>
  )
}
