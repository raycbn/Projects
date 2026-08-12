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
import { isDiscoverableCyclist, resolvePublicDisplayName } from '@/lib/communityIdentity'
import { alertService } from '@/services/AlertService'
import { deliverPendingFollowNotifications } from '@/lib/followNotify'
import { coordsFromGeometry } from '@/lib/routeThumb'
import { RouteThumb } from '@/components/athlete/RouteThumb'
import { CITY_CHALLENGES } from '@/content/growthContent'

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
  const [peopleQuery, setPeopleQuery] = useState('')
  const [cheers, setCheers] = useState<Record<string, { count: number; cheered: boolean }>>({})
  const [nearYou, setNearYou] = useState<PublicProfile[]>([])
  const [myCity, setMyCity] = useState<string | null>(null)
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
          try {
            await communityService.upsertPublicProfile({
              uid: user.uid,
              displayName: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Ciclista',
              photoURL: profile?.photoURL || user.photoURL || null,
              email: user.email || profile?.email,
            })
          } catch (error) {
            console.warn('[explore] upsert profile', error)
          }
        }
        const [publicRoutes, profiles] = await Promise.all([
          routeRepository.listPublic(30).catch((error) => {
            console.warn('[explore] routes', error)
            return [] as SavedRoute[]
          }),
          communityService.listPublicProfiles(48).catch((error) => {
            console.warn('[explore] profiles', error)
            throw error
          }),
        ])
        if (cancelled) return
        setRoutes(publicRoutes)
        setPeople(profiles)
        setAuthorNames((prev) => {
          const next = { ...prev }
          for (const p of profiles) next[p.uid] = p.displayName || 'Ciclista'
          return next
        })
        setMessage(null)
      } catch (error) {
        console.error('[explore]', error)
        if (!cancelled) setMessage('No se pudo cargar la comunidad. Prueba a recargar en unos segundos.')
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

  useEffect(() => {
    if (!signedIn || !user) return
    void deliverPendingFollowNotifications(user.uid)
    void communityService.getPublicProfile(user.uid).then((p) => {
      const city = p?.city?.trim() || null
      setMyCity(city)
      if (city) {
        void communityService.listNearYou(city, user.uid, 8).then(setNearYou).catch(() => setNearYou([]))
      }
    })
  }, [signedIn, user])

  useEffect(() => {
    const pool = [...feed, ...routes]
    if (!pool.length || !ready) return
    let cancelled = false
    async function loadCheers() {
      const next: Record<string, { count: number; cheered: boolean }> = {}
      const ids = [...new Set(pool.map((r) => r.id))].slice(0, 24)
      await Promise.all(
        ids.map(async (id) => {
          try {
            next[id] = await communityService.getCheersState(
              id,
              user && !user.isAnonymous ? user.uid : null,
            )
          } catch {
            next[id] = { count: 0, cheered: false }
          }
        }),
      )
      if (!cancelled) setCheers((prev) => ({ ...prev, ...next }))
    }
    void loadCheers()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, routes, ready, user?.uid])

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

  const visiblePeople = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase()
    return people
      .filter((p) => !user || p.uid !== user.uid)
      .filter(isDiscoverableCyclist)
      .filter((p) => {
        if (!q) return true
        const name = (p.displayName || '').toLowerCase()
        const bio = (p.bio || '').toLowerCase()
        return name.includes(q) || bio.includes(q)
      })
  }, [people, user, peopleQuery])

  async function handleCheers(routeId: string) {
    if (!signedIn || !user) {
      setMessage('Inicia sesión para dar Cheers.')
      return
    }
    try {
      const result = await communityService.toggleCheers(routeId, user.uid)
      setCheers((prev) => ({ ...prev, [routeId]: result }))
      if (result.cheered) {
        const cheerName =
          resolvePublicDisplayName(
            profile?.displayName ?? user.displayName,
            user.email ?? profile?.email,
          ) || 'Un ciclista'
        void alertService.notifyCheers(routeId, cheerName)
      }
    } catch (error) {
      console.warn('[cheers]', error)
      setMessage('No se pudo registrar el Cheers.')
    }
  }

  async function handleFollow(followeeId: string) {
    if (!signedIn || !user) {
      setMessage('Inicia sesión para seguir ciclistas.')
      return
    }
    if (followeeId === user.uid) return
    setBusyFollowId(followeeId)
    setMessage(null)
    try {
      const followerName =
        resolvePublicDisplayName(
          profile?.displayName ?? user.displayName,
          user.email ?? profile?.email,
        ) || 'Un ciclista'
      await communityService.upsertPublicProfile({
        uid: user.uid,
        displayName: profile?.displayName ?? user.displayName,
        photoURL: profile?.photoURL ?? user.photoURL,
        email: user.email ?? profile?.email,
      })
      await communityService.follow(user.uid, followeeId)
      track('community_follow', { followee: followeeId })
      setFollowingIds((prev) => new Set(prev).add(followeeId))
      setPeople((prev) =>
        prev.map((p) => (p.uid === followeeId ? { ...p, followersCount: p.followersCount + 1 } : p)),
      )
      void communityService
        .notifyFollowInbox({
          followeeId,
          followerId: user.uid,
          followerDisplayName: followerName,
        })
        .catch((err) => console.warn('[follow] inbox', err))
      void alertService.notifyFollow(followeeId, followerName)
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
                routes.map((route) => (
                  <RouteRow
                    key={route.id}
                    route={route}
                    authorLabel={authorNames[route.userId]}
                    cheers={cheers[route.id]}
                    onCheers={() => void handleCheers(route.id)}
                    canCheer={signedIn}
                  />
                ))
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
                        <Link to={`/ciclista/${person.uid}`} className="flex w-full flex-col items-center gap-2">
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
                        </Link>
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
                      cheers={cheers[route.id]}
                      onCheers={() => void handleCheers(route.id)}
                      canCheer={signedIn}
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

              {signedIn && myCity && nearYou.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-trail)]">
                    Cerca de ti · {myCity}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {nearYou.map((p) => (
                      <Link
                        key={p.uid}
                        to={`/ciclista/${p.uid}`}
                        className="rounded-full bg-[var(--color-mist)] px-3 py-1.5 text-sm font-semibold text-[var(--color-forest)]"
                      >
                        {p.displayName || 'Ciclista'}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : signedIn && !myCity ? (
                <p className="text-sm text-[var(--color-stone)]">
                  Añade tu ciudad en{' '}
                  <Link to="/perfil" className="font-semibold text-[var(--color-trail)]">
                    Perfil
                  </Link>{' '}
                  para ver ciclistas cerca de ti.
                </p>
              ) : null}

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                  Buscar ciclista
                </span>
                <input
                  type="search"
                  value={peopleQuery}
                  onChange={(e) => setPeopleQuery(e.target.value)}
                  placeholder="Nombre o bio…"
                  className="min-h-11 w-full rounded-xl border-0 bg-white/80 px-3 text-sm text-[var(--color-forest)] ring-1 ring-[var(--color-fog)] outline-none placeholder:text-[var(--color-stone)] focus:ring-2 focus:ring-[var(--color-trail)]"
                />
              </label>

              {visiblePeople.length === 0 ? (
                <Empty
                  hint={
                    peopleQuery.trim()
                      ? 'Ningún ciclista coincide con esa búsqueda.'
                      : 'Aún no hay ciclistas con perfil público real. Cuando alguien entre con nombre o publique rutas, aparecerá aquí.'
                  }
                />
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
                      <Link
                        to={`/ciclista/${person.uid}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
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
                      </Link>
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
                  Reto semanal por ciudad
                </h2>
                <p className="rounded-2xl bg-[var(--color-mist)]/70 px-4 py-3 text-sm text-[var(--color-stone)]">
                  Próximamente: ranking semanal real. Mientras tanto, estas son las ciudades piloto.
                </p>
                <ul className="divide-y divide-[var(--color-fog)] rounded-2xl bg-white/80 ring-1 ring-[var(--color-fog)]">
                  {CITY_CHALLENGES.map((c) => (
                    <li key={c.slug} className="px-4 py-3">
                      <p className="font-semibold text-[var(--color-forest)]">
                        {c.city} · {c.targetKm} km
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                          Próximamente
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--color-stone)]">{c.blurb}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-[var(--color-stone)]">
                  Pon tu ciudad en Perfil para «Cerca de ti» en Ciclistas.
                </p>
              </section>

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

function RouteRow({
  route,
  authorLabel,
  cheers,
  onCheers,
  canCheer,
}: {
  route: SavedRoute
  authorLabel?: string
  cheers?: { count: number; cheered: boolean }
  onCheers?: () => void
  canCheer?: boolean
}) {
  const points = coordsFromGeometry(route.geometry)
  return (
    <article className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {route.shareSlug ? (
              <Link to={`/route/${route.shareSlug}`}>
                <Button variant="ghost">Ver</Button>
              </Link>
            ) : null}
            {onCheers ? (
              <button
                type="button"
                disabled={!canCheer}
                onClick={onCheers}
                aria-pressed={cheers?.cheered === true}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition ${
                  cheers?.cheered
                    ? 'bg-[color-mix(in_oklab,var(--color-trail)_16%,white)] text-[var(--color-forest)] ring-1 ring-[var(--color-trail)]/30'
                    : 'text-[var(--color-stone)] ring-1 ring-[var(--color-fog)] hover:text-[var(--color-forest)]'
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block text-base leading-none ${
                    cheers?.cheered ? 'animate-cheer-pop' : ''
                  }`}
                >
                  🙌
                </span>
                <span>Cheers</span>
                {typeof cheers?.count === 'number' ? (
                  <span className="tabular-nums opacity-80">· {cheers.count}</span>
                ) : null}
              </button>
            ) : canCheer === false ? (
              <Link
                to="/login"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[var(--color-stone)] ring-1 ring-[var(--color-fog)]"
              >
                <span aria-hidden>🙌</span>
                Cheers · entrar
              </Link>
            ) : null}
          </div>
        </div>
        {points.length >= 2 ? (
          <RouteThumb points={points} width={88} height={56} className="shrink-0 opacity-90" />
        ) : null}
      </div>
    </article>
  )
}

function Empty({ hint }: { hint: string }) {
  return <p className="text-sm text-[var(--color-stone)]">{hint}</p>
}
