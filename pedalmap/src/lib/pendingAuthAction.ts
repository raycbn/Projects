/**
 * Remember why a guest opened the account sheet so Google redirect / /login
 * can return to the same route and finish save/share.
 *
 * Paths are allowlisted to avoid open redirects.
 */

import { isSorteoSignup } from '@/lib/sorteoSignup'

export type PendingAuthKind = 'save' | 'share' | 'story'
export type PendingAuthSource = 'ready_route' | 'trazar'

export type PendingAuthAction = {
  kind: PendingAuthKind
  source: PendingAuthSource
  returnPath: '/ruta' | '/route-planner'
  createdAt: number
}

const STORAGE_KEY = 'pedalmap_pending_auth'
const MAX_AGE_MS = 45 * 60 * 1000

let memory: PendingAuthAction | null = null

export function isAllowedAuthReturnPath(path: string | null | undefined): path is PendingAuthAction['returnPath'] {
  return path === '/ruta' || path === '/route-planner'
}

function parseAction(raw: unknown): PendingAuthAction | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<PendingAuthAction>
  if (value.kind !== 'save' && value.kind !== 'share' && value.kind !== 'story') return null
  if (value.source !== 'ready_route' && value.source !== 'trazar') return null
  if (!isAllowedAuthReturnPath(value.returnPath)) return null
  if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null
  if (Date.now() - value.createdAt > MAX_AGE_MS) return null
  return {
    kind: value.kind,
    source: value.source,
    returnPath: value.returnPath,
    createdAt: value.createdAt,
  }
}

function readSession(): PendingAuthAction | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parseAction(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

function writeSession(action: PendingAuthAction | null): void {
  try {
    if (!action) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(action))
  } catch {
    /* private mode / quota */
  }
}

export function setPendingAuthAction(input: {
  kind: PendingAuthKind
  source: PendingAuthSource
  returnPath: string
}): PendingAuthAction | null {
  if (!isAllowedAuthReturnPath(input.returnPath)) return null
  const action: PendingAuthAction = {
    kind: input.kind,
    source: input.source,
    returnPath: input.returnPath,
    createdAt: Date.now(),
  }
  memory = action
  writeSession(action)
  return action
}

export function peekPendingAuthAction(): PendingAuthAction | null {
  const next = parseAction(memory) ?? readSession()
  if (!next) {
    memory = null
    writeSession(null)
    return null
  }
  memory = next
  return next
}

/** Read + clear. Pass `source` to ignore (and keep) an action meant for another screen. */
export function consumePendingAuthAction(source?: PendingAuthSource): PendingAuthAction | null {
  const pending = peekPendingAuthAction()
  if (!pending) return null
  if (source && pending.source !== source) return null
  memory = null
  writeSession(null)
  return pending
}

export function clearPendingAuthAction(): void {
  memory = null
  writeSession(null)
}

/** After /login or Google, go back to the route instead of Mis rutas. */
export function postLoginPath(): string {
  const pending = peekPendingAuthAction()?.returnPath
  if (pending) return pending
  if (isSorteoSignup()) return '/sorteo?listo=1'
  return '/my-routes'
}

/** Emergency Google auth-bridge return URL (same-origin path only). */
export function googleBridgeReturnUrl(origin: string): string {
  const pending = peekPendingAuthAction()
  if (pending) return `${origin}${pending.returnPath}`
  if (isSorteoSignup()) return `${origin}/register?from=sorteo`
  return `${origin}/login`
}

export function pendingAuthTrackProps(): { from?: PendingAuthKind; via?: PendingAuthSource } {
  const pending = peekPendingAuthAction()
  if (!pending) return {}
  return { from: pending.kind, via: pending.source }
}
