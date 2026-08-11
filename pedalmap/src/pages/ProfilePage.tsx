import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { BikeSelector } from '@/components/route/BikeSelector'
import { RoutePreferencesPanel } from '@/components/route/RoutePreferences'
import { usePageMeta } from '@/hooks/usePageMeta'
import { track } from '@/lib/analytics'
import { WIND_ALERT } from '@/lib/windAlerts'
import { BRAND_EMAILS } from '@/lib/brandEmails'
import { ANNUAL_TRIAL_DAYS, FREE_TRIALS, type BikeType, type RoutePreference } from '@/domain/types'

export function ProfilePage() {
  usePageMeta({
    title: 'Perfil | PedalMap',
    description: 'Gestiona tu cuenta y preferencias de ciclismo en PedalMap.',
    path: '/perfil',
  })
  const { user, profile, logout, updateBikePreferences, updateNotifications } = useAuth()
  const [bikeType, setBikeType] = useState<BikeType>(profile?.bikePreferences.bikeType ?? 'road')
  const [preferences, setPreferences] = useState<RoutePreference[]>(
    profile?.bikePreferences.preferences ?? [],
  )
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [alertsBusy, setAlertsBusy] = useState(false)

  const windAlertsEnabled = Boolean(profile?.notifications?.windAlertsEnabled)
  const windAlertsEmail = Boolean(profile?.notifications?.windAlertsEmail)

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

  async function setWindAlerts(next: { windAlertsEnabled?: boolean; windAlertsEmail?: boolean }) {
    if (!profile) return
    setAlertsBusy(true)
    setMessage(null)
    try {
      const notifications = {
        windAlertsEnabled: next.windAlertsEnabled ?? windAlertsEnabled,
        windAlertsEmail: next.windAlertsEmail ?? windAlertsEmail,
      }
      if (!notifications.windAlertsEnabled) {
        notifications.windAlertsEmail = false
      }
      await updateNotifications(notifications)
      if (notifications.windAlertsEnabled && !windAlertsEnabled) {
        track('wind_alert_opt_in', { email: notifications.windAlertsEmail })
      }
      setMessage(
        notifications.windAlertsEnabled
          ? 'Avisos de mejor ventana activados. Márcalos en Mis rutas.'
          : 'Avisos de viento desactivados.',
      )
    } catch (error) {
      console.error('[profile] alerts', error)
      setMessage('No se pudieron guardar los avisos.')
    } finally {
      setAlertsBusy(false)
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
            <Link
              to="/my-routes"
              className="inline-flex text-sm font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
            >
              Mis rutas
            </Link>
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

          {!user.isAnonymous && (
            <div className="space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
              <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
                Avisos de viento
              </h2>
              <p className="text-sm leading-relaxed text-[var(--color-stone)]">
                Te avisamos en Mis rutas cuando una ruta marcada tenga una ventana excelente
                (próximas {WIND_ALERT.maxHoursAhead} h). Free: {FREE_TRIALS.windAlertRoutes} ruta ·
                Premium: todas.
              </p>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-forest)]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={windAlertsEnabled}
                  disabled={alertsBusy}
                  onChange={(e) =>
                    void setWindAlerts({ windAlertsEnabled: e.target.checked })
                  }
                />
                <span>Activar avisos de mejor ventana</span>
              </label>
              <label
                className={`flex items-start gap-3 text-sm ${
                  windAlertsEnabled
                    ? 'cursor-pointer text-[var(--color-forest)]'
                    : 'cursor-not-allowed text-[var(--color-stone)]/70'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={windAlertsEmail}
                  disabled={alertsBusy || !windAlertsEnabled}
                  onChange={(e) =>
                    void setWindAlerts({
                      windAlertsEnabled: true,
                      windAlertsEmail: e.target.checked,
                    })
                  }
                />
                <span>
                  También por email
                  <span className="block text-xs text-[var(--color-stone)]">
                    Listo cuando conectemos el correo ({BRAND_EMAILS.alerts}).
                  </span>
                </span>
              </label>
              <p className="text-xs text-[var(--color-stone)]">
                Anual Premium incluye {ANNUAL_TRIAL_DAYS} días de prueba —{' '}
                <Link to="/premium" className="font-semibold text-[var(--color-trail)] hover:underline">
                  ver planes
                </Link>
                .
              </p>
            </div>
          )}

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
