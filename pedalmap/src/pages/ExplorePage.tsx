import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { communityService } from '@/services/CommunityService'
import { routeRepository } from '@/services/RouteRepository'
import type { PublicProfile, SavedRoute } from '@/domain/types'
import { formatDistance, formatElevation } from '@/lib/stats'
import { seoPages } from '@/content/seoPages'
import { DEMO_PUBLIC_ROUTES } from '@/content/demoPublicRoutes'
import { track } from '@/lib/analytics'

type Tab = 'rutas' | 'siguiendo' | 'ciclistas' | 'mas'

export function ExplorePage() {
  usePageMeta({
    title: 'Explorar comunidad | PedalMap',
    description: 'Rutas públicas, feed de seguidos y ciclistas en PedalMap.',
    path: '/explorar',
  })

  const { user, profile, firebaseReady } = useAuth()
  const [tab, setTab] = useState<Tab>('rutas')
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [feed, setFeed] = useState<SavedRoute[]>([])
  const [people, setPeople] = useState<PublicProfile[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followingProfiles, setFollowingProfiles] = useState<PublicProfile[]>([])
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(false)
  const [busyFollowId, setBusyFollowId] = useState<string | null>(null)
  const ready = firebaseReady && communityService.isConfigured()
  const signedIn = Boolean(user && !user.isAnonymous)

  const refreshFollowing = useCallback(async () => {
    if (!ready || !user || user.isAnonymous) {
      setFollowingIds(new Set())
      setFollowingProfiles([])
      return [] as string[]
    }
    const [ids, profiles] = await Promise.all([
      communityService.listFollowingIds(user.uid),
      communityService.listFollowingProfiles(user.uid),
    ])
    setFollowingIds(new Set(ids))
    setFollowingProfiles(profiles)
    setAuthorNames((prev) => {
      const next = { ...prev }
      for (const p of profiles) next[p.uid] = p.displayName || 'Ciclista'
      return next
    })
    return ids
  }, [ready, user])

  const refreshFeed = useCallback(async () => {
    if (!ready || !user || user.isAnonymous) {
      setFeed([])
      return
    }
    setFeedLoading(true)
    try {
      const rows = await communityService.listFollowingFeed(user.uid, 30)
      setFeed(rows)
    } catch (error) {
      console.warn('[explore] feed', error)
      setFeed([])
    } finally {
      setFeedLoading(false)
    }
  }, [ready, user])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!ready) {
        setLoading(false)
        return
      }
      try {
        if (user && !user.isAnonymous) {
          await communityService.upsertPublicProfile({
            uid: user.uid,
            displayName: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Ciclista',
            photoURL: profile?.photoURL || user.photoURL || null,
            bio: '',
          })
        }
        const [publicRoutes, profiles] = await Promise.all([
          routeRepository.listPublic(30),
          communityService.listPublicProfiles(48),
        ])
        if (cancelled) return
        setRoutes(publicRoutes)
        setPeople(profiles)
        setAuthorNames((prev) => {
          const next = { ...prev }
          for (const p of profiles) next[p.uid] = p.displayName || 'Ciclista'
          return next
        })
      } catch (error) {
        console.error('[explore]', error)
        if (!cancelled) setMessage('No se pudo cargar la comunidad. Despliega reglas/índices Firestore.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ready, user, profile?.displayName, profile?.photoURL])

  useEffect(() => {
    let cancelled = false
    async function loadSocial() {
      if (!ready || !user || user.isAnonymous) {
        setFollowingIds(new Set())
        setFollowingProfiles([])
        setFeed([])
        return
      }
      try {
        await refreshFollowing()
        if (!cancelled) await refreshFeed()
      } catch (error) {
        console.warn('[explore] social', error)
      }
    }
    void loadSocial()
    return () => {
      cancelled = true
    }
  }, [ready, user, refreshFollowing, refreshFeed])

  const tabs = useMemo(
    () =>
      [
        ['rutas', 'Rutas'],
        ['siguiendo', 'Siguiendo'],
        ['ciclistas', 'Ciclistas'],
        ['mas', 'Más'],
      ] as const,
    [],
  )

  const visiblePeople = useMemo(
    () => people.filter((p) => !user || p.uid !== user.uid),
    [people, user],
  )

  async function handleFollow(followeeId: string) {
    if (!signedIn || !user) {
      setMessage('Inicia sesión para seguir ciclistas.')
      return
    }
    if (followeeId === user.uid) return
    setBusyFollowId(followeeId)
    setMessage(null)
    try {
      await communityService.follow(user.uid, followeeId)
      track('community_follow', { followeeId })
      setFollowingIds((prev) => new Set(prev).add(followeeId))
      setPeople((prev) =>
        prev.map((p) => (p.uid === followeeId ? { ...p, followersCount: p.followersCount + 1 } : p)),
      )
      await refreshFollowing()
      if (tab === 'siguiendo') await refreshFeed()
      setMessage('Ahora sigues a este ciclista.')
    } catch (error) {
      console.error(error)
      setMessage('No se pudo seguir. Revisa reglas Firestore o vuelve a intentar.')
    } finally {
      setBusyFollowId(null)
    }
  }

  async function handleUnfollow(followeeId: string) {
    if (!signedIn || !user) {
      setMessage('Inicia sesión para gestionar seguidos.')
      return
    }
    setBusyFollowId(followeeId)
    setMessage(null)
    try {
      await communityService.unfollow(user.uid, followeeId)
      track('community_unfollow', { followeeId })
      setFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(followeeId)
        return next
      })
      setPeople((prev) =>
        prev.map((p) =>
          p.uid === followeeId ? { ...p, followersCount: Math.max(0, p.followersCount - 1) } : p,
        ),
      )
      await refreshFollowing()
      if (tab === 'siguiendo') await refreshFeed()
      setMessage('Dejaste de seguir a este ciclista.')
    } catch (error) {
      console.error(error)
      setMessage('No se pudo dejar de seguir. Inténtalo de nuevo.')
    } finally {
      setBusyFollowId(null)
    }
  }

  return (
    <div className="page-wrap space-y-5 py-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--pm-blue)]">Comunidad</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[color:var(--pm-ink)] sm:text-4xl">Explorar</h1>
        <p className="max-w-2xl text-sm text-[color:var(--pm-muted)] sm:text-base">
          Rutas públicas, ciclistas a seguir y un feed de lo que publican quienes sigues.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              tab === id
                ? 'bg-[color:var(--pm-ink)] text-white'
                : 'border border-[color:var(--pm-line)] bg-white text-[color:var(--pm-ink)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <p className="rounded-2xl border border-[color:var(--pm-line)] bg-white px-4 py-3 text-sm text-[color:var(--pm-muted)]">
          {message}
        </p>
      ) : null}

      {tab === 'rutas' ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-[color:var(--pm-ink)]">Rutas públicas</h2>
          {loading ? <p className="text-sm text-[color:var(--pm-muted)]">Cargando…</p> : null}
          {!loading && routes.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[color:var(--pm-muted)]">
                Aún no hay rutas públicas reales. Mientras, explora estas demos locales (no se guardan en la nube).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {DEMO_PUBLIC_ROUTES.map((route) => (
                  <article key={route.id} className="rounded-2xl border border-[color:var(--pm-line)] bg-white p-4 shadow-[var(--pm-shadow)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--pm-blue)]">Demo</p>
                    <h3 className="mt-1 font-display text-lg font-bold text-[color:var(--pm-ink)]">{route.name}</h3>
                    <p className="mt-1 text-sm text-[color:var(--pm-muted)]">
                      {formatDistance(route.stats.distanceKm)} · {formatElevation(route.stats.elevationGainM)} · {route.surface}
                    </p>
                    <Link to={`/ruta/${route.id}`} className="mt-3 inline-flex text-sm font-semibold text-[color:var(--pm-blue)]">
                      Abrir ruta →
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {routes.map((route) => (
              <article key={route.id} className="rounded-2xl border border-[color:var(--pm-line)] bg-white p-4 shadow-[var(--pm-shadow)]">
                <h3 className="font-display text-lg font-bold text-[color:var(--pm-ink)]">{route.name}</h3>
                <p className="mt-1 text-sm text-[color:var(--pm-muted)]">
                  {formatDistance(route.stats.distanceKm)} · {formatElevation(route.stats.elevationGainM)} · {route.surface}
                </p>
                <Link to={`/ruta/${route.id}`} className="mt-3 inline-flex text-sm font-semibold text-[color:var(--pm-blue)]">
                  Abrir ruta →
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'siguiendo' ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-[color:var(--pm-ink)]">Siguiendo</h2>
            <p className="text-sm text-[color:var(--pm-muted)]">
              Rutas públicas de los ciclistas que sigues, ordenadas por lo más reciente.
            </p>
          </div>

          {!signedIn ? (
            <div className="rounded-2xl border border-[color:var(--pm-line)] bg-white p-5 shadow-[var(--pm-shadow)]">
              <p className="text-sm text-[color:var(--pm-muted)]">
                Inicia sesión para ver el feed de quienes sigues.
              </p>
              <Link to="/perfil" className="mt-3 inline-flex">
                <Button type="button">Ir a Perfil / login</Button>
              </Link>
            </div>
          ) : null}

          {signedIn && followingProfiles.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {followingProfiles.map((person) => {
                const name = person.displayName || 'Ciclista'
                return (
                <div
                  key={person.uid}
                  className="flex min-w-[7.5rem] shrink-0 flex-col items-center gap-2 rounded-2xl border border-[color:var(--pm-line)] bg-white px-3 py-3"
                >
                  {person.photoURL ? (
                    <img src={person.photoURL} alt="" className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--pm-fog)] text-sm font-bold text-[color:var(--pm-ink)]">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <p className="w-full truncate text-center text-xs font-semibold text-[color:var(--pm-ink)]">
                    {name}
                  </p>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[color:var(--pm-muted)] underline-offset-2 hover:underline"
                    disabled={busyFollowId === person.uid}
                    onClick={() => void handleUnfollow(person.uid)}
                  >
                    Dejar
                  </button>
                </div>
              )})}
            </div>
          ) : null}

          {signedIn && feedLoading ? <p className="text-sm text-[color:var(--pm-muted)]">Cargando feed…</p> : null}

          {signedIn && !feedLoading && followingIds.size === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--pm-line)] bg-white p-5">
              <p className="font-display text-lg font-bold text-[color:var(--pm-ink)]">Aún no sigues a nadie</p>
              <p className="mt-1 text-sm text-[color:var(--pm-muted)]">
                Ve a Ciclistas, pulsa Seguir y aquí verás sus rutas públicas.
              </p>
              <Button type="button" className="mt-3" onClick={() => setTab('ciclistas')}>
                Ver ciclistas
              </Button>
            </div>
          ) : null}

          {signedIn && !feedLoading && followingIds.size > 0 && feed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--pm-line)] bg-white p-5">
              <p className="font-display text-lg font-bold text-[color:var(--pm-ink)]">Sin rutas nuevas</p>
              <p className="mt-1 text-sm text-[color:var(--pm-muted)]">
                Las personas que sigues aún no han publicado rutas públicas. Cuando lo hagan, aparecerán aquí.
              </p>
              <Button type="button" variant="secondary" className="mt-3" onClick={() => setTab('ciclistas')}>
                Seguir a más ciclistas
              </Button>
            </div>
          ) : null}

          {signedIn && feed.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {feed.map((route) => (
                <article key={route.id} className="rounded-2xl border border-[color:var(--pm-line)] bg-white p-4 shadow-[var(--pm-shadow)]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--pm-blue)]">
                    {authorNames[route.userId] || 'Ciclista'}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold text-[color:var(--pm-ink)]">{route.name}</h3>
                  <p className="mt-1 text-sm text-[color:var(--pm-muted)]">
                    {formatDistance(route.stats.distanceKm)} · {formatElevation(route.stats.elevationGainM)}
                  </p>
                  <Link to={`/ruta/${route.id}`} className="mt-3 inline-flex text-sm font-semibold text-[color:var(--pm-blue)]">
                    Abrir ruta →
                  </Link>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'ciclistas' ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-[color:var(--pm-ink)]">Ciclistas</h2>
            <p className="text-sm text-[color:var(--pm-muted)]">
              Descubre perfiles públicos y síguelos para llenar tu feed de Siguiendo.
            </p>
          </div>

          {!signedIn ? (
            <div className="rounded-2xl border border-[color:var(--pm-line)] bg-white p-4">
              <p className="text-sm text-[color:var(--pm-muted)]">
                Puedes explorar perfiles. Inicia sesión para seguir y ver su actividad en Siguiendo.
              </p>
              <Link to="/perfil" className="mt-2 inline-flex text-sm font-semibold text-[color:var(--pm-blue)]">
                Ir a Perfil / login →
              </Link>
            </div>
          ) : null}

          {loading ? <p className="text-sm text-[color:var(--pm-muted)]">Cargando ciclistas…</p> : null}

          {!loading && visiblePeople.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--pm-line)] bg-white p-5">
              <p className="font-display text-lg font-bold text-[color:var(--pm-ink)]">Aún no hay ciclistas públicos</p>
              <p className="mt-1 text-sm text-[color:var(--pm-muted)]">
                En cuanto alguien entre en Explorar con cuenta, aparecerá aquí. Tú ya estás listo si has iniciado sesión.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {visiblePeople.map((person) => {
              const isFollowing = followingIds.has(person.uid)
              const busy = busyFollowId === person.uid
              const name = person.displayName || 'Ciclista'
              return (
                <article key={person.uid} className="rounded-2xl border border-[color:var(--pm-line)] bg-white p-4 shadow-[var(--pm-shadow)]">
                  <div className="flex items-start gap-3">
                    {person.photoURL ? (
                      <img src={person.photoURL} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--pm-fog)] text-base font-bold text-[color:var(--pm-ink)]">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-lg font-bold text-[color:var(--pm-ink)]">{name}</h3>
                      <p className="mt-0.5 text-sm text-[color:var(--pm-muted)]">
                        {person.followersCount} seguidores · {person.routesPublicCount} rutas
                      </p>
                      {person.bio ? <p className="mt-2 line-clamp-2 text-sm text-[color:var(--pm-ink)]">{person.bio}</p> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isFollowing ? (
                      <>
                        <span className="inline-flex min-h-11 items-center rounded-full bg-[color:var(--pm-fog)] px-4 text-sm font-semibold text-[color:var(--pm-ink)]">
                          Siguiendo
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!signedIn || busy}
                          onClick={() => void handleUnfollow(person.uid)}
                        >
                          {busy ? '…' : 'Dejar de seguir'}
                        </Button>
                      </>
                    ) : (
                      <Button type="button" disabled={!signedIn || busy} onClick={() => void handleFollow(person.uid)}>
                        {busy ? '…' : 'Seguir'}
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {tab === 'mas' ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-[color:var(--pm-ink)]">Más para explorar</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {seoPages.map((page) => (
              <Link
                key={page.slug}
                to={`/explorar/${page.slug}`}
                className="rounded-2xl border border-[color:var(--pm-line)] bg-white p-4 shadow-[var(--pm-shadow)] transition hover:border-[color:var(--pm-blue)]"
              >
                <h3 className="font-display text-lg font-bold text-[color:var(--pm-ink)]">{page.title}</h3>
                <p className="mt-1 text-sm text-[color:var(--pm-muted)]">{page.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
