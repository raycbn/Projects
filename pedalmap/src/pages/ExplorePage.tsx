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
      await communityService.upsertPublicProfile({
        uid: user.uid,
        displayName: profile?.displayName ?? user.displayName,
        photoURL: profile?.photoURL ?? user.photoURL,
      })
      await communityService.follow(user.uid, followeeId)
      track('community_follow', { followee: followeeId })
      setFollowingIds((prev) => new Set(prev).add(followeeId))
      setPeople((prev) =>
        prev.map((p) => (p.uid === followeeId ? { ...p, followersCount: p.followersCount + 1 } : p)),
      )
      await refreshFollowing()
      await refreshFeed()
      setMessage('Ahora sigues a este ciclista.')
    } catch (error) {
      console.error('[follow]', error)
      setMessage('No se pudo seguir. Revisa login y reglas Firestore.')
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
      await refreshFeed()
      setMessage('Dejaste de seguir a este ciclista.')
    } catch (error) {
      console.error('[unfollow]', error)
      setMessage('No se pudo dejar de seguir. Inténtalo de nuevo.')
    } finally {
      setBusyFollowId(null)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 pb-24">
      <p className="label-caps text-[var(--color-trail)]">Comunidad</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
        Explorar
      </h1>
      <p className="mt-2 text-[var(--color-stone)]">
        Rutas públicas y ciclistas. Sin rankings fabricables ni seed demos.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? 'min-h-11 rounded-xl bg-[var(--color-signal)] px-3 py-1.5 text-sm font-semibold text-[var(--color-ink)]'
                : 'min-h-11 rounded-xl bg-white/80 px-3 py-1.5 text-sm font-semibold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-[var(--color-mist)] px-3 py-2 text-sm text-[var(--color-forest)]">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-[var(--color-stone)]">Cargando comunidad…</p>
      ) : (
        <div className="mt-8 space-y-4">
          {tab === 'rutas' && (
            <>
              {routes.length === 0 ? (
                <div className="space-y-4">
                  <Empty hint="Aún no hay rutas públicas de la comunidad. Mientras tanto, estas ideas de Madrid/Sierra:" />
                  {DEMO_PUBLIC_ROUTES.map((route) => (
                    <article
                      key={route.id}
                      className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-trail)]">
                            Demo · {route.area}
                          </p>
                          <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
                            {route.title}
                          </h2>
                          <p className="text-xs text-[var(--color-stone)]">
                            {route.bikeType} · {formatDistance(route.distanceMeters)} ·{' '}
                            {formatElevation(route.elevationGainMeters)}
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-stone)]">{route.blurb}</p>
                        </div>
                        <Link to="/route-planner">
                          <Button variant="ghost">Crear similar</Button>
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                routes.map((route) => <RouteRow key={route.id} route={route} />)
              )}
            </>
          )}

          {tab === 'siguiendo' && (
            <div className="space-y-4">
              {!signedIn ? (
                <div className="space-y-3 rounded-2xl bg-white/80 px-4 py-4 ring-1 ring-[var(--color-fog)]">
                  <Empty hint="Inicia sesión para ver el feed de quienes sigues." />
                  <Link to="/perfil">
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
                        className="flex min-w-[7.5rem] shrink-0 flex-col items-center gap-2 rounded-2xl bg-white/80 px-3 py-3 ring-1 ring-[var(--color-fog)]"
                      >
                        {person.photoURL ? (
                          <img src={person.photoURL} alt="" className="h-11 w-11 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-mist)] text-sm font-bold text-[var(--color-forest)]">
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <p className="w-full truncate text-center text-xs font-semibold text-[var(--color-forest)]">
                          {name}
                        </p>
                        <button
                          type="button"
                          className="min-h-8 text-[11px] font-semibold text-[var(--color-stone)] underline-offset-2 hover:underline"
                          disabled={busyFollowId === person.uid}
                          onClick={() => void handleUnfollow(person.uid)}
                        >
                          Dejar
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {signedIn && feedLoading ? (
                <p className="text-sm text-[var(--color-stone)]">Cargando feed…</p>
              ) : null}

              {signedIn && !feedLoading && followingIds.size === 0 ? (
                <div className="space-y-3 rounded-2xl bg-white/80 px-4 py-4 ring-1 ring-[var(--color-fog)]">
                  <p className="font-display text-lg font-bold text-[var(--color-forest)]">
                    Aún no sigues a nadie
                  </p>
                  <Empty hint="Ve a Ciclistas, pulsa Seguir y aquí verás sus rutas públicas." />
                  <Button type="button" onClick={() => setTab('ciclistas')}>
                    Ver ciclistas
                  </Button>
                </div>
              ) : null}

              {signedIn && !feedLoading && followingIds.size > 0 && feed.length === 0 ? (
                <div className="space-y-3 rounded-2xl bg-white/80 px-4 py-4 ring-1 ring-[var(--color-fog)]">
                  <p className="font-display text-lg font-bold text-[var(--color-forest)]">
                    Sin rutas nuevas
                  </p>
                  <Empty hint="Quienes sigues aún no han publicado rutas públicas. Cuando lo hagan, aparecerán aquí." />
                  <Button type="button" variant="secondary" onClick={() => setTab('ciclistas')}>
                    Seguir a más ciclistas
                  </Button>
                </div>
              ) : null}

              {signedIn && feed.length > 0
                ? feed.map((route) => (
                    <RouteRow
                      key={route.id}
                      route={route}
                      authorLabel={authorNames[route.userId] || 'Ciclista'}
                    />
                  ))
                : null}
            </div>
          )}

          {tab === 'ciclistas' && (
            <div className="space-y-4">
              {!signedIn ? (
                <div className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]">
                  <Empty hint="Puedes explorar perfiles. Inicia sesión para seguir y ver su actividad en Siguiendo." />
                  <Link to="/perfil" className="mt-2 inline-flex text-sm font-semibold text-[var(--color-trail)]">
                    Ir a Perfil / login →
                  </Link>
                </div>
              ) : null}

              {visiblePeople.length === 0 ? (
                <Empty hint="No hay perfiles públicos todavía. Entra y sigue a alguien tras el primer login." />
              ) : (
                visiblePeople.map((person) => {
                  const isFollowing = followingIds.has(person.uid)
                  const busy = busyFollowId === person.uid
                  const name = person.displayName || 'Ciclista'
                  return (
                    <article
                      key={person.uid}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {person.photoURL ? (
                          <img src={person.photoURL} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-mist)] text-sm font-bold text-[var(--color-forest)]">
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <h2 className="truncate font-display text-lg font-bold text-[var(--color-forest)]">
                            {name}
                          </h2>
                          <p className="text-xs text-[var(--color-stone)]">
                            {person.followersCount} seguidores · {person.routesPublicCount} rutas
                          </p>
                          {person.bio ? (
                            <p className="mt-1 line-clamp-2 text-sm text-[var(--color-stone)]">{person.bio}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                        {isFollowing ? (
                          <>
                            <span className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-mist)] px-3 text-sm font-semibold text-[var(--color-forest)]">
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
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!signedIn || busy}
                            onClick={() => void handleFollow(person.uid)}
                          >
                            {busy ? '…' : 'Seguir'}
                          </Button>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          )}

          {tab === 'mas' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
                  Guías prácticas
                </h2>
                <div className="grid gap-3">
                  {seoPages
                    .filter((p) => (p.kind ?? 'intent') !== 'city')
                    .map((page) => (
                      <Link
                        key={page.path}
                        to={page.path}
                        className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
                      >
                        <p className="font-semibold text-[var(--color-forest)]">{page.heading}</p>
                        <p className="mt-1 text-sm text-[var(--color-stone)]">{page.description}</p>
                      </Link>
                    ))}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
                  Guías por ciudad
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {seoPages
                    .filter((p) => p.kind === 'city')
                    .map((page) => (
                      <Link
                        key={page.path}
                        to={page.path}
                        className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
                      >
                        <p className="font-semibold text-[var(--color-forest)]">{page.heading}</p>
                        <p className="mt-1 text-sm text-[var(--color-stone)] line-clamp-2">
                          {page.description}
                        </p>
                      </Link>
                    ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      <Link to="/route-planner" className="mt-8 inline-block">
        <Button>Crear mi ruta</Button>
      </Link>
    </main>
  )
}

function RouteRow({ route, authorLabel }: { route: SavedRoute; authorLabel?: string }) {
  return (
    <article className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          {authorLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-trail)]">
              {authorLabel}
            </p>
          ) : null}
          <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">{route.title}</h2>
          <p className="text-xs text-[var(--color-stone)]">
            {route.bikeType} · {formatDistance(route.stats.distanceMeters)} ·{' '}
            {formatElevation(route.stats.elevationGainMeters)}
          </p>
        </div>
        {route.shareSlug && (
          <Link to={`/route/${route.shareSlug}`}>
            <Button variant="ghost">Ver</Button>
          </Link>
        )}
      </div>
    </article>
  )
}

function Empty({ hint }: { hint: string }) {
  return <p className="text-sm text-[var(--color-stone)]">{hint}</p>
}
