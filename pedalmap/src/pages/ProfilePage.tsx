import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { BikeSelector } from '@/components/route/BikeSelector'
import { RoutePreferencesPanel } from '@/components/route/RoutePreferences'
import { usePageMeta } from '@/hooks/usePageMeta'
import { track } from '@/lib/analytics'
import { WIND_ALERT } from '@/lib/windAlerts'
import { BRAND_EMAILS } from '@/lib/brandEmails'
import { enableFollowPushPreference } from '@/lib/followNotify'
import { resolvePublicDisplayName } from '@/lib/communityIdentity'
import { formatDistance, formatDuration, formatElevation } from '@/lib/stats'
import {
  buildYearHeatmap,
  evaluateMilestones,
  sumWeekStats,
  sumYearStats,
} from '@/lib/athleteStats'
import { coordsFromGeometry, coordsFromTrack } from '@/lib/routeThumb'
import { RouteThumb } from '@/components/athlete/RouteThumb'
import { ActivityHeatmap } from '@/components/athlete/ActivityHeatmap'
import { communityService } from '@/services/CommunityService'
import { activityRepository } from '@/services/ActivityRepository'
import { routeRepository } from '@/services/RouteRepository'
import { grupetaService } from '@/services/GrupetaService'
import { doc, getDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import {
  ANNUAL_TRIAL_DAYS,
  FREE_TRIALS,
  type Activity,
  type BikeType,
  type PublicProfile,
  type RoutePreference,
  type SavedRoute,
} from '@/domain/types'

export function ProfilePage() {
  usePageMeta({
    title: 'Perfil | PedalMap',
    description: 'Tu perfil de ciclista en PedalMap: salidas, rutas y comunidad.',
    path: '/perfil',
    noindex: true,
  })
  const { user, profile, logout, updateBikePreferences, updateNotifications } = useAuth()
  const [bikeType, setBikeType] = useState<BikeType>(profile?.bikePreferences.bikeType ?? 'road')
  const [preferences, setPreferences] = useState<RoutePreference[]>(
    profile?.bikePreferences.preferences ?? [],
  )
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [alertsBusy, setAlertsBusy] = useState(false)
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null)
  const [bioDraft, setBioDraft] = useState('')
  const [cityDraft, setCityDraft] = useState('')
  const [bioSaving, setBioSaving] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [trialing, setTrialing] = useState(false)
  const [trialEnd, setTrialEnd] = useState<string | null>(null)
  const [ownsGrupetaPack, setOwnsGrupetaPack] = useState(false)

  const windAlertsEnabled = Boolean(profile?.notifications?.windAlertsEnabled)
  const windAlertsEmail = Boolean(profile?.notifications?.windAlertsEmail)
  const followAlertsEmail = profile?.notifications?.followAlertsEmail !== false
  const followAlertsPush = Boolean(profile?.notifications?.followAlertsPush)
  const activitiesPublic = Boolean(profile?.notifications?.activitiesPublic)

  const displayName = useMemo(
    () =>
      resolvePublicDisplayName(profile?.displayName ?? user?.displayName, profile?.email ?? user?.email) ||
      (user?.isAnonymous ? 'Invitado' : 'Ciclista'),
    [profile?.displayName, profile?.email, user?.displayName, user?.email, user?.isAnonymous],
  )
  const photoURL = profile?.photoURL || user?.photoURL || null
  const yearStats = useMemo(() => sumYearStats(activities), [activities])
  const weekStats = useMemo(() => sumWeekStats(activities), [activities])
  const heatDays = useMemo(() => buildYearHeatmap(activities), [activities])
  const milestones = useMemo(
    () =>
      evaluateMilestones({
        activities,
        routes,
        followersCount: publicProfile?.followersCount ?? 0,
      }),
    [activities, routes, publicProfile?.followersCount],
  )
  const coverPoints = useMemo(() => {
    const lastAct = activities.find((a) => a.status === 'finished' && a.track?.length >= 2)
    if (lastAct) return coordsFromTrack(lastAct.track)
    const lastRoute = routes.find((r) => coordsFromGeometry(r.geometry).length >= 2)
    return lastRoute ? coordsFromGeometry(lastRoute.geometry) : []
  }, [activities, routes])
  const recentActivities = useMemo(
    () => activities.filter((a) => a.status === 'finished').slice(0, 5),
    [activities],
  )
  const recentRoutes = useMemo(() => routes.slice(0, 5), [routes])

  useEffect(() => {
    if (!profile) return
    setBikeType(profile.bikePreferences.bikeType)
    setPreferences(profile.bikePreferences.preferences)
  }, [profile])

  useEffect(() => {
    let cancelled = false
    async function loadPack() {
      if (!user || user.isAnonymous || !grupetaService.isConfigured()) {
        setOwnsGrupetaPack(false)
        return
      }
      try {
        const res = await grupetaService.getPack()
        if (cancelled) return
        setOwnsGrupetaPack(
          Boolean(res.pack?.viewerRole === 'owner' && res.pack.billable),
        )
      } catch {
        if (!cancelled) setOwnsGrupetaPack(false)
      }
    }
    void loadPack()
    return () => {
      cancelled = true
    }
  }, [user?.uid, profile?.plan])

  useEffect(() => {
    let cancelled = false
    async function loadAthlete() {
      if (!user || user.isAnonymous || !communityService.isConfigured()) {
        setPublicProfile(null)
        setActivities([])
        setRoutes([])
        return
      }
      setStatsLoading(true)
      try {
        await communityService.upsertPublicProfile({
          uid: user.uid,
          displayName: profile?.displayName ?? user.displayName,
          photoURL: profile?.photoURL ?? user.photoURL,
          email: user.email ?? profile?.email,
        }).catch(() => undefined)

        const [pub, acts, ownRoutes] = await Promise.all([
          communityService.getPublicProfile(user.uid),
          activityRepository.isConfigured()
            ? activityRepository.listForUser(user.uid)
            : Promise.resolve([] as Activity[]),
          routeRepository.isConfigured()
            ? routeRepository.listByUser(user.uid)
            : Promise.resolve([] as SavedRoute[]),
        ])
        if (cancelled) return
        setPublicProfile(pub)
        setBioDraft(pub?.bio || '')
        setCityDraft(pub?.city || '')
        setActivities(acts)
        setRoutes(ownRoutes)
        try {
          const sub = await getDoc(doc(getDb(), 'subscriptions', user.uid))
          const status = String(sub.data()?.status || '')
          setTrialing(status === 'trialing')
          const end = sub.data()?.currentPeriodEnd
          setTrialEnd(end ? String(end) : null)
        } catch {
          setTrialing(false)
        }
      } catch (error) {
        console.warn('[perfil] athlete load', error)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    void loadAthlete()
    return () => {
      cancelled = true
    }
    // Intentionally omit publicProfile.bio to avoid loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.displayName, profile?.photoURL, profile?.email])

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

  async function handleSaveBio() {
    if (!user || user.isAnonymous) return
    setBioSaving(true)
    setMessage(null)
    try {
      await communityService.upsertPublicProfile({
        uid: user.uid,
        displayName: profile?.displayName ?? user.displayName,
        photoURL: profile?.photoURL ?? user.photoURL,
        email: user.email ?? profile?.email,
        bio: bioDraft.trim().slice(0, 280),
        city: cityDraft.trim().slice(0, 40) || null,
      })
      const pub = await communityService.getPublicProfile(user.uid)
      setPublicProfile(pub)
      setMessage('Perfil público actualizado.')
    } catch (error) {
      console.error('[profile] bio', error)
      setMessage('No se pudo guardar la bio.')
    } finally {
      setBioSaving(false)
    }
  }

  async function setWindAlerts(next: { windAlertsEnabled?: boolean; windAlertsEmail?: boolean }) {
    if (!profile) return
    setAlertsBusy(true)
    setMessage(null)
    try {
      const notifications = {
        ...profile.notifications,
        windAlertsEnabled: next.windAlertsEnabled ?? windAlertsEnabled,
        windAlertsEmail: next.windAlertsEmail ?? windAlertsEmail,
        followAlertsEmail,
        followAlertsPush,
        activitiesPublic,
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

  async function setFollowAlerts(next: {
    followAlertsEmail?: boolean
    followAlertsPush?: boolean
  }) {
    if (!profile || !user || user.isAnonymous) return
    setAlertsBusy(true)
    setMessage(null)
    try {
      let push = next.followAlertsPush ?? followAlertsPush
      if (next.followAlertsPush === true) {
        const ok = await enableFollowPushPreference(user.uid)
        push = ok
        if (!ok) {
          setMessage('Activa las notificaciones del navegador para avisos en la PWA.')
        }
      }
      await updateNotifications({
        ...profile.notifications,
        windAlertsEnabled,
        windAlertsEmail,
        followAlertsEmail: next.followAlertsEmail ?? followAlertsEmail,
        followAlertsPush: push,
        activitiesPublic,
      })
      if (next.followAlertsPush !== true || push) {
        setMessage('Avisos de comunidad guardados.')
      }
    } catch (error) {
      console.error('[profile] follow alerts', error)
      setMessage('No se pudieron guardar los avisos de comunidad.')
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
          {/* Athlete hero */}
          <section className="overflow-hidden rounded-3xl bg-white/80 ring-1 ring-[var(--color-fog)]">
            <div className="relative h-28 overflow-hidden bg-[linear-gradient(135deg,var(--color-forest),var(--color-trail))] sm:h-32">
              {coverPoints.length >= 2 ? (
                <div className="absolute inset-0 flex items-center justify-center opacity-90">
                  <RouteThumb
                    points={coverPoints}
                    width={360}
                    height={120}
                    stroke="rgba(255,255,255,0.85)"
                    className="h-full w-full max-w-none"
                  />
                </div>
              ) : null}
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(7,21,16,0.35))]" />
            </div>
            <div className="relative px-5 pb-5 pt-0">
              <div className="-mt-10 flex items-end gap-4">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-white"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-mist)] font-display text-2xl font-bold text-[var(--color-forest)] ring-4 ring-white">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-2xl font-extrabold text-[var(--color-forest)]">
                      {displayName}
                    </h2>
                    <span className="rounded-full bg-[var(--color-mist)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-forest)]">
                      {trialing ? 'Trial' : profile?.plan === 'premium' ? 'Premium' : 'Free'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-[var(--color-stone)]">
                    {profile?.email || (user.isAnonymous ? 'Sesión de invitado' : '—')}
                  </p>
                </div>
              </div>

              {trialing ? (
                <p className="mt-3 rounded-2xl bg-[var(--color-mist)] px-3 py-2 text-sm text-[var(--color-forest)]">
                  Prueba Premium activa
                  {trialEnd
                    ? ` · hasta ${new Date(trialEnd).toLocaleDateString('es-ES')}`
                    : ` · ${ANNUAL_TRIAL_DAYS} días en el plan anual`}
                  . Gestiona en{' '}
                  <Link to="/premium" className="font-semibold text-[var(--color-trail)]">
                    Premium
                  </Link>
                  .
                </p>
              ) : null}

              {!user.isAnonymous ? (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-[var(--color-mist)]/70 px-2 py-3">
                    <p className="font-display text-xl font-bold text-[var(--color-forest)]">
                      {publicProfile?.followersCount ?? 0}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                      Seguidores
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-mist)]/70 px-2 py-3">
                    <p className="font-display text-xl font-bold text-[var(--color-forest)]">
                      {publicProfile?.followingCount ?? 0}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                      Siguiendo
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-mist)]/70 px-2 py-3">
                    <p className="font-display text-xl font-bold text-[var(--color-forest)]">
                      {publicProfile?.routesPublicCount ?? routes.filter((r) => r.isPublic).length}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                      Rutas
                    </p>
                  </div>
                </div>
              ) : null}

              {!user.isAnonymous ? (
                <div className="mt-4 space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                    Bio pública
                  </label>
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value.slice(0, 280))}
                    rows={2}
                    placeholder="Cómo ruedas: zona, bici, objetivos…"
                    className="w-full rounded-2xl border-0 bg-[var(--color-mist)]/50 px-3 py-2 text-sm text-[var(--color-forest)] ring-1 ring-[var(--color-fog)] outline-none placeholder:text-[var(--color-stone)] focus:ring-2 focus:ring-[var(--color-trail)]"
                  />
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={cityDraft}
                    onChange={(e) => setCityDraft(e.target.value.slice(0, 40))}
                    placeholder="Madrid, Barcelona…"
                    className="min-h-11 w-full rounded-2xl border-0 bg-[var(--color-mist)]/50 px-3 text-sm text-[var(--color-forest)] ring-1 ring-[var(--color-fog)] outline-none placeholder:text-[var(--color-stone)] focus:ring-2 focus:ring-[var(--color-trail)]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--color-stone)]">{bioDraft.length}/280</p>
                    <Button type="button" variant="secondary" disabled={bioSaving} onClick={() => void handleSaveBio()}>
                      {bioSaving ? 'Guardando…' : 'Guardar perfil'}
                    </Button>
                  </div>
                  <Link
                    to={`/ciclista/${user.uid}`}
                    className="inline-flex text-sm font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
                  >
                    Ver mi perfil público →
                  </Link>
                </div>
              ) : null}
            </div>
          </section>

          {/* Week + year + heatmap + compact milestones — one composition */}
          {!user.isAnonymous ? (
            <section className="space-y-4 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
                  Actividad
                </h2>
                <Link to="/actividades" className="text-sm font-semibold text-[var(--color-trail)]">
                  Ver todo
                </Link>
              </div>
              {statsLoading ? (
                <p className="text-sm text-[var(--color-stone)]">Cargando estadísticas…</p>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                      Esta semana
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-forest)]">
                      <span className="font-semibold">{weekStats.rides}</span> salidas ·{' '}
                      {formatDistance(weekStats.distanceMeters)} ·{' '}
                      {formatElevation(weekStats.elevationGainMeters)} ·{' '}
                      {formatDuration(weekStats.movingSeconds)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Año · salidas" value={String(yearStats.rides)} />
                    <Stat label="Distancia" value={formatDistance(yearStats.distanceMeters)} />
                    <Stat label="Desnivel" value={formatElevation(yearStats.elevationGainMeters)} />
                    <Stat label="Tiempo" value={formatDuration(yearStats.movingSeconds)} />
                  </div>
                  <ActivityHeatmap days={heatDays} className="mt-1" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                      Hitos
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {milestones.map((m) => (
                        <li
                          key={m.id}
                          title={m.hint}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            m.unlocked
                              ? 'bg-[var(--color-mist)] text-[var(--color-forest)]'
                              : 'text-[var(--color-stone)] ring-1 ring-[var(--color-fog)]'
                          }`}
                        >
                          {m.unlocked ? '✓ ' : ''}
                          {m.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {ownsGrupetaPack ? (
            <section className="space-y-2 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
              <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Pack Grupeta</h2>
              <p className="text-sm text-[var(--color-stone)]">
                Eres el titular: asigna hasta 3 emails de tu grupeta.
              </p>
              <Link to="/premium#grupeta">
                <Button type="button" variant="secondary">
                  Gestionar Pack Grupeta
                </Button>
              </Link>
            </section>
          ) : !user.isAnonymous && profile?.plan !== 'premium' ? (
            <section className="space-y-2 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
              <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Pack Grupeta</h2>
              <p className="text-sm text-[var(--color-stone)]">
                4 Premium por 14,99 €/mes o 119,99 €/año. Ideal para salir juntos.
              </p>
              <Link to="/premium#grupeta">
                <Button type="button" variant="secondary">
                  Ver Pack Grupeta
                </Button>
              </Link>
            </section>
          ) : null}

          {/* Recent activities */}
          {!user.isAnonymous ? (
            <section className="space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
                  Últimas salidas
                </h2>
                <Link to="/actividades" className="text-sm font-semibold text-[var(--color-trail)]">
                  Rodadas
                </Link>
              </div>
              {recentActivities.length === 0 ? (
                <p className="text-sm text-[var(--color-stone)]">
                  Aún no hay salidas. Graba en vivo o sincroniza tu GPS.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentActivities.map((activity) => {
                    const pts = coordsFromTrack(activity.track)
                    return (
                      <li key={activity.id}>
                        <Link
                          to={`/actividades/${activity.id}`}
                          className="flex items-center gap-3 rounded-2xl bg-[var(--color-mist)]/50 px-3 py-3 transition hover:bg-[var(--color-mist)]"
                        >
                          {pts.length >= 2 ? (
                            <RouteThumb points={pts} width={64} height={40} className="shrink-0 opacity-90" />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[var(--color-forest)]">
                              {activity.title}
                            </p>
                            <p className="text-xs text-[var(--color-stone)]">
                              {formatDistance(activity.stats.distanceMeters)} ·{' '}
                              {formatElevation(activity.stats.elevationGainMeters)} ·{' '}
                              {formatDuration(activity.stats.movingTimeSeconds ?? activity.stats.durationSeconds)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Link to="/actividades/conectar" className="inline-flex text-sm font-semibold text-[var(--color-trail)]">
                Conectar GPS →
              </Link>
            </section>
          ) : null}

          {/* Recent routes */}
          {!user.isAnonymous ? (
            <section className="space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
                  Mis rutas
                </h2>
                <Link to="/my-routes" className="text-sm font-semibold text-[var(--color-trail)]">
                  Todas
                </Link>
              </div>
              {recentRoutes.length === 0 ? (
                <p className="text-sm text-[var(--color-stone)]">
                  Todavía no has guardado rutas. Crea una y guárdala.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentRoutes.map((route) => (
                    <li key={route.id}>
                      <Link
                        to={route.shareSlug ? `/route/${route.shareSlug}` : '/my-routes'}
                        className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--color-mist)]/50 px-3 py-3 transition hover:bg-[var(--color-mist)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--color-forest)]">{route.title}</p>
                          <p className="text-xs text-[var(--color-stone)]">
                            {formatDistance(route.stats.distanceMeters)} ·{' '}
                            {formatElevation(route.stats.elevationGainMeters)}
                            {route.isPublic ? ' · Pública' : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-[var(--color-trail)]">Ver</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/route-planner" className="inline-flex text-sm font-semibold text-[var(--color-trail)]">
                Crear ruta →
              </Link>
            </section>
          ) : null}

          <div className="space-y-4 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
            <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
              Preferencias de bici
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
                (próximas {WIND_ALERT.maxHoursAhead} h; al abrir la app). Free:{' '}
                {FREE_TRIALS.windAlertRoutes} ruta · Premium: todas.
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
                    Te llega desde {BRAND_EMAILS.alerts} al abrir Mis rutas si hay una ventana
                    excelente.
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

          {!user.isAnonymous && (
            <div className="space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
              <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
                Avisos de comunidad
              </h2>
              <p className="text-sm leading-relaxed text-[var(--color-stone)]">
                Cuando alguien te sigue, te avisamos por correo. Si instalas la PWA y activas
                notificaciones, también lo verás al abrir la app.
              </p>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-forest)]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={followAlertsEmail}
                  disabled={alertsBusy}
                  onChange={(e) =>
                    void setFollowAlerts({ followAlertsEmail: e.target.checked })
                  }
                />
                <span>
                  Email cuando alguien me sigue
                  <span className="block text-xs text-[var(--color-stone)]">
                    Desde {BRAND_EMAILS.alerts}. Si no tienes la PWA, el correo incluye los pasos
                    para instalarla.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-forest)]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={followAlertsPush}
                  disabled={alertsBusy}
                  onChange={(e) =>
                    void setFollowAlerts({ followAlertsPush: e.target.checked })
                  }
                />
                <span>
                  Notificación en la app (PWA)
                  <span className="block text-xs text-[var(--color-stone)]">
                    iPhone: Safari → Compartir → Añadir a pantalla de inicio. Android: Chrome →
                    Instalar app. Luego abre PedalMap desde el icono y acepta avisos.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-forest)]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={activitiesPublic}
                  disabled={alertsBusy}
                  onChange={(e) => {
                    if (!profile) return
                    setAlertsBusy(true)
                    void updateNotifications({
                      ...profile.notifications,
                      windAlertsEnabled,
                      windAlertsEmail,
                      followAlertsEmail,
                      followAlertsPush,
                      activitiesPublic: e.target.checked,
                    })
                      .then(() => setMessage(
                        e.target.checked
                          ? 'Las nuevas salidas pueden publicarse en tu perfil (márcalas en cada salida).'
                          : 'Salidas públicas desactivadas por defecto.',
                      ))
                      .catch(() => setMessage('No se pudo guardar la preferencia.'))
                      .finally(() => setAlertsBusy(false))
                  }}
                />
                <span>
                  Actividad pública (opt-in)
                  <span className="block text-xs text-[var(--color-stone)]">
                    Permite marcar salidas como públicas en tu ficha de ciclista. Por defecto siguen
                    privadas.
                  </span>
                </span>
              </label>
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
                to="/explorar"
                className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
              >
                Explorar
              </Link>
              {profile?.plan === 'premium' ? null : (
                <Link
                  to="/premium"
                  className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
                >
                  Premium
                </Link>
              )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-mist)]/70 px-3 py-3 text-center">
      <p className="font-display text-lg font-bold text-[var(--color-forest)]">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
        {label}
      </p>
    </div>
  )
}
