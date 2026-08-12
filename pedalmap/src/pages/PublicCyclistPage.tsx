import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { communityService } from '@/services/CommunityService'
import { routeRepository } from '@/services/RouteRepository'
import { alertService } from '@/services/AlertService'
import { resolvePublicDisplayName } from '@/lib/communityIdentity'
import { formatDistance, formatElevation } from '@/lib/stats'
import { track } from '@/lib/analytics'
import type { PublicProfile, SavedRoute } from '@/domain/types'

export function PublicCyclistPage() {
  const { uid = '' } = useParams()
  const { user, profile, firebaseReady } = useAuth()
  const [person, setPerson] = useState<PublicProfile | null>(null)
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const ready = firebaseReady && communityService.isConfigured()
  const signedIn = Boolean(user && !user.isAnonymous)
  const isSelf = Boolean(user && uid && user.uid === uid)

  const name = useMemo(
    () => resolvePublicDisplayName(person?.displayName, null) || 'Ciclista',
    [person?.displayName],
  )

  usePageMeta({
    title: `${name} | PedalMap`,
    description: `Perfil público de ${name} en PedalMap.`,
    path: uid ? `/ciclista/${uid}` : '/explorar',
  })

  const reload = useCallback(async () => {
    if (!ready || !uid) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [pub, publicRoutes] = await Promise.all([
        communityService.getPublicProfile(uid),
        routeRepository.listPublicByUserIds([uid], 20),
      ])
      setPerson(pub)
      setRoutes(publicRoutes)
      if (signedIn && user && !isSelf) {
        setFollowing(await communityService.isFollowing(user.uid, uid))
      } else {
        setFollowing(false)
      }
    } catch (error) {
      console.warn('[ciclista]', error)
      setPerson(null)
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }, [ready, uid, signedIn, user, isSelf])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleFollow() {
    if (!signedIn || !user || !uid || isSelf) {
      setMessage('Inicia sesión para seguir ciclistas.')
      return
    }
    setBusy(true)
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
      await communityService.follow(user.uid, uid)
      track('community_follow', { followee: uid })
      setFollowing(true)
      setPerson((prev) =>
        prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : prev,
      )
      void communityService
        .notifyFollowInbox({
          followeeId: uid,
          followerId: user.uid,
          followerDisplayName: followerName,
        })
        .catch(() => undefined)
      void alertService.notifyFollow(uid, followerName)
      setMessage('Ahora sigues a este ciclista.')
    } catch (error) {
      console.error('[ciclista] follow', error)
      setMessage('No se pudo seguir. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnfollow() {
    if (!signedIn || !user || !uid) return
    setBusy(true)
    setMessage(null)
    try {
      await communityService.unfollow(user.uid, uid)
      setFollowing(false)
      setPerson((prev) =>
        prev
          ? { ...prev, followersCount: Math.max(0, (prev.followersCount || 1) - 1) }
          : prev,
      )
      setMessage('Dejaste de seguir a este ciclista.')
    } catch (error) {
      console.error('[ciclista] unfollow', error)
      setMessage('No se pudo dejar de seguir.')
    } finally {
      setBusy(false)
    }
  }

  if (!uid) return <Navigate to="/explorar" replace />

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 pb-24">
      <Link to="/explorar" className="text-sm font-semibold text-[var(--color-trail)]">
        ← Explorar
      </Link>

      {loading ? (
        <p className="mt-8 text-sm text-[var(--color-stone)]">Cargando perfil…</p>
      ) : !person || person.isPublic === false ? (
        <div className="mt-8 space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
          <h1 className="font-display text-2xl font-extrabold text-[var(--color-forest)]">
            Perfil no disponible
          </h1>
          <p className="text-sm text-[var(--color-stone)]">
            Este ciclista aún no tiene perfil público o no existe.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <section className="overflow-hidden rounded-3xl bg-white/80 ring-1 ring-[var(--color-fog)]">
            <div className="h-20 bg-[linear-gradient(135deg,var(--color-forest),var(--color-trail))] sm:h-24" />
            <div className="relative px-5 pb-5">
              <div className="-mt-10 flex items-end gap-4">
                {person.photoURL ? (
                  <img
                    src={person.photoURL}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-white"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-mist)] font-display text-2xl font-bold text-[var(--color-forest)] ring-4 ring-white">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1 pb-1">
                  <h1 className="truncate font-display text-2xl font-extrabold text-[var(--color-forest)]">
                    {name}
                  </h1>
                  {person.bio ? (
                    <p className="mt-1 text-sm text-[var(--color-stone)]">{person.bio}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-[var(--color-mist)]/70 px-2 py-3">
                  <p className="font-display text-xl font-bold text-[var(--color-forest)]">
                    {person.followersCount}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                    Seguidores
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--color-mist)]/70 px-2 py-3">
                  <p className="font-display text-xl font-bold text-[var(--color-forest)]">
                    {person.followingCount}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                    Siguiendo
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--color-mist)]/70 px-2 py-3">
                  <p className="font-display text-xl font-bold text-[var(--color-forest)]">
                    {person.routesPublicCount}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
                    Rutas
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {isSelf ? (
                  <Link to="/perfil">
                    <Button type="button" variant="secondary">
                      Editar mi perfil
                    </Button>
                  </Link>
                ) : following ? (
                  <>
                    <span className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-mist)] px-4 text-sm font-semibold text-[var(--color-forest)]">
                      Siguiendo
                    </span>
                    <Button type="button" variant="secondary" disabled={!signedIn || busy} onClick={() => void handleUnfollow()}>
                      {busy ? '…' : 'Dejar de seguir'}
                    </Button>
                  </>
                ) : (
                  <Button type="button" disabled={!signedIn || busy} onClick={() => void handleFollow()}>
                    {busy ? '…' : 'Seguir'}
                  </Button>
                )}
              </div>
              {message ? <p className="mt-3 text-sm text-[var(--color-trail)]">{message}</p> : null}
              {!signedIn && !isSelf ? (
                <p className="mt-2 text-sm text-[var(--color-stone)]">
                  <Link to="/perfil" className="font-semibold text-[var(--color-trail)]">
                    Inicia sesión
                  </Link>{' '}
                  para seguir a {name}.
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)]">
            <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
              Rutas públicas
            </h2>
            {routes.length === 0 ? (
              <p className="text-sm text-[var(--color-stone)]">
                Todavía no ha publicado rutas públicas.
              </p>
            ) : (
              <ul className="space-y-2">
                {routes.map((route) => (
                  <li key={route.id}>
                    <Link
                      to={route.shareSlug ? `/route/${route.shareSlug}` : '/explorar'}
                      className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--color-mist)]/50 px-3 py-3 transition hover:bg-[var(--color-mist)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--color-forest)]">{route.title}</p>
                        <p className="text-xs text-[var(--color-stone)]">
                          {formatDistance(route.stats.distanceMeters)} ·{' '}
                          {formatElevation(route.stats.elevationGainMeters)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-[var(--color-trail)]">Ver</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
