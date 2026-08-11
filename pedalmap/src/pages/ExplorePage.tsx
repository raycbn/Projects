import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { communityService } from '@/services/CommunityService'
import { routeRepository } from '@/services/RouteRepository'
import type { Challenge, PublicProfile, SavedRoute, Segment } from '@/domain/types'
import { formatDistance, formatElevation } from '@/lib/stats'
import { seoPages } from '@/content/seoPages'
import { DEMO_PUBLIC_ROUTES } from '@/content/demoPublicRoutes'
import { track } from '@/lib/analytics'

type Tab = 'rutas' | 'ciclistas' | 'mas'

export function ExplorePage() {
  usePageMeta({
    title: 'Explorar comunidad | PedalMap',
    description: 'Rutas públicas, ciclistas, segmentos, retos y rankings en PedalMap.',
    path: '/explorar',
  })

  const { user, profile, firebaseReady } = useAuth()
  const [tab, setTab] = useState<Tab>('rutas')
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [people, setPeople] = useState<PublicProfile[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [, setRankings] = useState<Array<{ userId: string; displayName?: string; score: number; rank: number }>>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const ready = firebaseReady && communityService.isConfigured()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!ready) {
        setLoading(false)
        return
      }
      try {
        const [publicRoutes, profiles, segs, chals, board] = await Promise.all([
          routeRepository.listPublic(30),
          communityService.listPublicProfiles(24),
          communityService.listSegments(20),
          communityService.listChallenges(20),
          communityService.listRankingBoard('weekly_distance', 20),
        ])
        if (cancelled) return
        setRoutes(publicRoutes)
        setPeople(profiles)
        setSegments(segs)
        setChallenges(chals)
        setRankings(board)
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
  }, [ready])

  const tabs = useMemo(
    () =>
      [
        ['rutas', 'Rutas'],
        ['ciclistas', 'Ciclistas'],
        ['mas', 'Más'],
      ] as const,
    [],
  )

  async function handleFollow(followeeId: string) {
    if (!user || user.isAnonymous) {
      setMessage('Inicia sesión para seguir ciclistas.')
      return
    }
    try {
      await communityService.upsertPublicProfile({
        uid: user.uid,
        displayName: profile?.displayName ?? user.displayName,
        photoURL: profile?.photoURL ?? user.photoURL,
      })
      await communityService.follow(user.uid, followeeId)
      track('community_follow', { followee: followeeId })
      setMessage('Ahora sigues a este ciclista.')
      const profiles = await communityService.listPublicProfiles(24)
      setPeople(profiles)
    } catch (error) {
      console.error('[follow]', error)
      setMessage('No se pudo seguir. Revisa login y reglas Firestore.')
    }
  }

  async function seedDemoChallenge() {
    if (!user || user.isAnonymous) {
      setMessage('Inicia sesión para crear un reto.')
      return
    }
    try {
      const id = await communityService.createChallenge({
        title: 'Reto semanal PedalMap',
        description: 'Suma desnivel positivo esta semana.',
        createdBy: user.uid,
        isPublic: true,
        metric: 'elevation',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      await communityService.upsertChallengeEntry({
        challengeId: id,
        userId: user.uid,
        displayName: profile?.displayName ?? 'Ciclista',
        value: 0,
        updatedAt: new Date().toISOString(),
      })
      await communityService.upsertRankingEntry('weekly_distance', {
        userId: user.uid,
        displayName: profile?.displayName ?? 'Ciclista',
        score: 0,
        updatedAt: new Date().toISOString(),
      })
      setChallenges(await communityService.listChallenges(20))
      setRankings(await communityService.listRankingBoard('weekly_distance', 20))
      setMessage('Reto creado.')
      setTab('mas')
    } catch (error) {
      console.error('[challenge]', error)
      setMessage('No se pudo crear el reto.')
    }
  }

  async function seedSegment() {
    if (!user || user.isAnonymous) {
      setMessage('Inicia sesión para publicar un segmento.')
      return
    }
    try {
      await communityService.createSegment({
        name: 'Puerto de prueba Madrid',
        description: 'Segmento comunitario de ejemplo (Vallecas → sur).',
        createdBy: user.uid,
        isPublic: true,
        start: { lat: 40.38, lng: -3.62 },
        end: { lat: 40.21, lng: -3.57 },
        distanceMeters: 12000,
        elevationGainMeters: 280,
      })
      setSegments(await communityService.listSegments(20))
      setMessage('Segmento publicado.')
      setTab('mas')
    } catch (error) {
      console.error('[segment]', error)
      setMessage('No se pudo crear el segmento.')
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 pb-24">
      <p className="label-caps text-[var(--color-trail)]">Comunidad</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--color-forest)]">
        Explorar
      </h1>
      <p className="mt-2 text-[var(--color-stone)]">
        Rutas públicas y ciclistas. Sin ruido: solo lo que hay contenido real.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? 'rounded-xl bg-[var(--color-signal)] px-3 py-1.5 text-sm font-semibold text-[var(--color-ink)]'
                : 'rounded-xl bg-white/80 px-3 py-1.5 text-sm font-semibold text-[var(--color-forest)] ring-1 ring-[var(--color-fog)]'
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
                  <article
                    key={route.id}
                    className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
                          {route.title}
                        </h2>
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
                ))
              )}
            </>
          )}

          {tab === 'ciclistas' && (
            <>
              {people.length === 0 ? (
                <Empty hint="No hay perfiles públicos todavía. Entra y sigue a alguien tras el primer login." />
              ) : (
                people.map((person) => (
                  <article
                    key={person.uid}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
                  >
                    <div>
                      <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
                        {person.displayName || 'Ciclista'}
                      </h2>
                      <p className="text-xs text-[var(--color-stone)]">
                        {person.followersCount} seguidores · {person.followingCount} siguiendo
                      </p>
                    </div>
                    {user && user.uid !== person.uid && (
                      <Button variant="secondary" onClick={() => void handleFollow(person.uid)}>
                        Seguir
                      </Button>
                    )}
                  </article>
                ))
              )}
            </>
          )}

          {tab === 'mas' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Guías</h2>
                <div className="grid gap-3">
                  {seoPages.map((page) => (
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
                  Segmentos y retos
                </h2>
                <p className="text-sm text-[var(--color-stone)]">
                  Todavía hay poco contenido comunitario. Cuando haya masa crítica, volverán como
                  secciones propias.
                </p>
                {user && !user.isAnonymous && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => void seedSegment()}>
                      Publicar segmento
                    </Button>
                    <Button variant="ghost" onClick={() => void seedDemoChallenge()}>
                      Crear reto
                    </Button>
                  </div>
                )}
                {segments.slice(0, 3).map((seg) => (
                  <article
                    key={seg.id}
                    className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
                  >
                    <h3 className="font-semibold text-[var(--color-forest)]">{seg.name}</h3>
                    <p className="text-sm text-[var(--color-stone)]">
                      {formatDistance(seg.distanceMeters)} · {formatElevation(seg.elevationGainMeters)}
                    </p>
                  </article>
                ))}
                {challenges.slice(0, 3).map((ch) => (
                  <article
                    key={ch.id}
                    className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-[var(--color-fog)]"
                  >
                    <h3 className="font-semibold text-[var(--color-forest)]">{ch.title}</h3>
                    <p className="text-sm text-[var(--color-stone)]">
                      {ch.metric} · hasta {new Date(ch.endAt).toLocaleDateString('es-ES')}
                    </p>
                  </article>
                ))}
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

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-fog)] bg-white/60 px-4 py-6 text-sm text-[var(--color-stone)]">
      <p>{hint}</p>
      <Link to="/route-planner" className="mt-4 inline-block">
        <Button size="sm">Crear mi ruta</Button>
      </Link>
    </div>
  )
}
