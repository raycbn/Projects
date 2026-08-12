import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import type {
  Challenge,
  ChallengeEntry,
  FollowEdge,
  InboxNotification,
  PublicProfile,
  RankingEntry,
  SavedRoute,
  Segment,
  SegmentEffort,
} from '@/domain/types'
import { getDb, isFirebaseConfigured } from '@/lib/firebase'
import { resolvePublicDisplayName } from '@/lib/communityIdentity'
import { routeRepository } from '@/services/RouteRepository'

function mapPublicProfile(id: string, data: DocumentData): PublicProfile {
  return {
    uid: id,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    bio: data.bio,
    isPublic: data.isPublic !== false,
    followersCount: data.followersCount ?? 0,
    followingCount: data.followingCount ?? 0,
    routesPublicCount: data.routesPublicCount ?? 0,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? new Date().toISOString(),
  }
}

export class CommunityService {
  isConfigured(): boolean {
    return isFirebaseConfigured()
  }

  async upsertPublicProfile(input: {
    uid: string
    displayName: string | null
    photoURL: string | null
    bio?: string
    email?: string | null
  }): Promise<void> {
    const ref = doc(getDb(), 'publicProfiles', input.uid)
    const existing = await getDoc(ref)
    const displayName =
      resolvePublicDisplayName(input.displayName, input.email) ??
      resolvePublicDisplayName(existing.data()?.displayName as string | null, input.email)
    await setDoc(
      ref,
      {
        displayName,
        photoURL: input.photoURL,
        bio: input.bio ?? existing.data()?.bio ?? '',
        isPublic: true,
        followersCount: existing.data()?.followersCount ?? 0,
        followingCount: existing.data()?.followingCount ?? 0,
        routesPublicCount: existing.data()?.routesPublicCount ?? 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  async getPublicProfile(uid: string): Promise<PublicProfile | null> {
    const snap = await getDoc(doc(getDb(), 'publicProfiles', uid))
    if (!snap.exists()) return null
    return mapPublicProfile(snap.id, snap.data())
  }

  async listPublicProfiles(max = 24): Promise<PublicProfile[]> {
    // Equality-only query — no composite index required. Sort client-side.
    const q = query(
      collection(getDb(), 'publicProfiles'),
      where('isPublic', '==', true),
      limit(Math.max(max * 2, 48)),
    )
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => mapPublicProfile(d.id, d.data()))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, max)
  }

  async follow(followerId: string, followeeId: string): Promise<void> {
    if (followerId === followeeId) return
    if (await this.isFollowing(followerId, followeeId)) return

    const edgeRef = doc(getDb(), 'follows', followerId, 'following', followeeId)
    const reverseRef = doc(getDb(), 'follows', followeeId, 'followers', followerId)
    const batch = writeBatch(getDb())
    batch.set(edgeRef, {
      followerId,
      followeeId,
      createdAt: serverTimestamp(),
    })
    batch.set(reverseRef, {
      followerId,
      followeeId,
      createdAt: serverTimestamp(),
    })

    const followerProfile = doc(getDb(), 'publicProfiles', followerId)
    const followeeProfile = doc(getDb(), 'publicProfiles', followeeId)
    const [a, b] = await Promise.all([getDoc(followerProfile), getDoc(followeeProfile)])
    batch.set(
      followerProfile,
      {
        followingCount: (a.data()?.followingCount ?? 0) + 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    if (b.exists()) {
      // Non-owners may only touch followersCount + updatedAt (see firestore.rules).
      batch.set(
        followeeProfile,
        {
          followersCount: (b.data()?.followersCount ?? 0) + 1,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } else {
      // Lean stub so follow counts work — keep private so it does not pollute Ciclistas.
      batch.set(followeeProfile, {
        followersCount: 1,
        followingCount: 0,
        routesPublicCount: 0,
        isPublic: false,
        displayName: null,
        photoURL: null,
        bio: '',
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }

  async unfollow(followerId: string, followeeId: string): Promise<void> {
    if (!(await this.isFollowing(followerId, followeeId))) return

    const edgeRef = doc(getDb(), 'follows', followerId, 'following', followeeId)
    const reverseRef = doc(getDb(), 'follows', followeeId, 'followers', followerId)
    const batch = writeBatch(getDb())
    batch.delete(edgeRef)
    batch.delete(reverseRef)
    const followerProfile = doc(getDb(), 'publicProfiles', followerId)
    const followeeProfile = doc(getDb(), 'publicProfiles', followeeId)
    const [a, b] = await Promise.all([getDoc(followerProfile), getDoc(followeeProfile)])
    batch.set(
      followerProfile,
      {
        followingCount: Math.max(0, (a.data()?.followingCount ?? 1) - 1),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    if (b.exists()) {
      batch.set(
        followeeProfile,
        {
          followersCount: Math.max(0, (b.data()?.followersCount ?? 1) - 1),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }
    await batch.commit()
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const snap = await getDoc(doc(getDb(), 'follows', followerId, 'following', followeeId))
    return snap.exists()
  }

  async listFollowingIds(followerId: string): Promise<string[]> {
    const edges = await this.listFollowing(followerId)
    return edges.map((e) => e.followeeId)
  }

  async listFollowing(followerId: string): Promise<FollowEdge[]> {
    const snap = await getDocs(collection(getDb(), 'follows', followerId, 'following'))
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        followerId: data.followerId ?? followerId,
        followeeId: data.followeeId ?? d.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
      }
    })
  }

  /** Profiles of people you follow (for Siguiendo header chips). */
  async listFollowingProfiles(followerId: string, max = 40): Promise<PublicProfile[]> {
    const ids = (await this.listFollowingIds(followerId)).slice(0, max)
    if (!ids.length) return []
    const rows: PublicProfile[] = []
    await Promise.all(
      ids.map(async (uid) => {
        const profile = await this.getPublicProfile(uid)
        if (profile) rows.push(profile)
      }),
    )
    return rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }

  /** Public routes from people you follow (feed). */
  async listFollowingFeed(followerId: string, max = 30): Promise<SavedRoute[]> {
    const edges = await this.listFollowing(followerId)
    const ids = edges.map((e) => e.followeeId)
    if (!ids.length) return []
    return routeRepository.listPublicByUserIds(ids, max)
  }

  /** Soft in-app inbox item when A follows B. */
  async notifyFollowInbox(input: {
    followeeId: string
    followerId: string
    followerDisplayName: string
  }): Promise<void> {
    const ref = doc(collection(getDb(), 'notifications', input.followeeId, 'items'))
    await setDoc(ref, {
      type: 'follow',
      fromUserId: input.followerId,
      fromDisplayName: input.followerDisplayName,
      toUserId: input.followeeId,
      createdAt: serverTimestamp(),
      read: false,
    })
  }

  async listUnreadFollowNotifications(userId: string, max = 20): Promise<InboxNotification[]> {
    const q = query(
      collection(getDb(), 'notifications', userId, 'items'),
      where('read', '==', false),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => {
        const data = d.data()
        return {
          id: d.id,
          type: 'follow' as const,
          fromUserId: String(data.fromUserId || ''),
          fromDisplayName: String(data.fromDisplayName || 'Ciclista'),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
          read: Boolean(data.read),
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async markNotificationsRead(userId: string, ids: string[]): Promise<void> {
    if (!ids.length) return
    const batch = writeBatch(getDb())
    for (const id of ids) {
      batch.set(
        doc(getDb(), 'notifications', userId, 'items', id),
        { read: true },
        { merge: true },
      )
    }
    await batch.commit()
  }

  async listSegments(max = 30): Promise<Segment[]> {
    const q = query(
      collection(getDb(), 'segments'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Segment, 'id'>) }))
  }

  async createSegment(input: Omit<Segment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = doc(collection(getDb(), 'segments'))
    await setDoc(ref, {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async listSegmentEfforts(segmentId: string, max = 20): Promise<SegmentEffort[]> {
    const q = query(
      collection(getDb(), 'segmentEfforts'),
      where('segmentId', '==', segmentId),
      orderBy('durationSeconds', 'asc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SegmentEffort, 'id'>) }))
  }

  async submitSegmentEffort(input: Omit<SegmentEffort, 'id'>): Promise<string> {
    const ref = doc(collection(getDb(), 'segmentEfforts'))
    await setDoc(ref, input)
    return ref.id
  }

  async listChallenges(max = 20): Promise<Challenge[]> {
    const q = query(
      collection(getDb(), 'challenges'),
      where('isPublic', '==', true),
      orderBy('startAt', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }))
  }

  async createChallenge(input: Omit<Challenge, 'id' | 'createdAt'>): Promise<string> {
    const ref = doc(collection(getDb(), 'challenges'))
    await setDoc(ref, { ...input, createdAt: serverTimestamp() })
    return ref.id
  }

  async upsertChallengeEntry(input: Omit<ChallengeEntry, 'id'> & { id?: string }): Promise<void> {
    const ref = input.id
      ? doc(getDb(), 'challengeEntries', input.id)
      : doc(collection(getDb(), 'challengeEntries'))
    const { id: _id, ...rest } = input
    await setDoc(ref, { ...rest, updatedAt: serverTimestamp() }, { merge: true })
  }

  async listChallengeLeaderboard(challengeId: string, max = 20): Promise<ChallengeEntry[]> {
    const q = query(
      collection(getDb(), 'challengeEntries'),
      where('challengeId', '==', challengeId),
      orderBy('value', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChallengeEntry, 'id'>) }))
  }

  async listRankingBoard(boardId: string, max = 25): Promise<RankingEntry[]> {
    const q = query(
      collection(getDb(), 'rankings', boardId, 'entries'),
      orderBy('score', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d, index) => {
      const data = d.data()
      return {
        userId: d.id,
        displayName: data.displayName,
        score: data.score ?? 0,
        rank: data.rank ?? index + 1,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
      }
    })
  }

  async upsertRankingEntry(boardId: string, entry: Omit<RankingEntry, 'rank'>): Promise<void> {
    await setDoc(
      doc(getDb(), 'rankings', boardId, 'entries', entry.userId),
      { ...entry, updatedAt: serverTimestamp() },
      { merge: true },
    )
  }
}

export const communityService = new CommunityService()
