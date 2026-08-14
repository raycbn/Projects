import { useEffect, useRef } from 'react'
import { useAuth } from '@/app/AuthContext'
import {
  consumePendingAuthAction,
  peekPendingAuthAction,
  type PendingAuthSource,
} from '@/lib/pendingAuthAction'

/**
 * After Google redirect or in-place sign-in, finish the save/share the guest started.
 * Consumes the pending action once; does not run for another screen's intent.
 */
export function useResumePendingAuthAction(opts: {
  source: PendingAuthSource
  ready: boolean
  onSave: () => void | Promise<void>
  onShare: () => void | Promise<void>
}): boolean {
  const { user, profile, loading } = useAuth()
  const onSaveRef = useRef(opts.onSave)
  const onShareRef = useRef(opts.onShare)
  onSaveRef.current = opts.onSave
  onShareRef.current = opts.onShare

  const pending = !loading && Boolean(peekPendingAuthAction()?.source === opts.source)

  useEffect(() => {
    if (!opts.ready || loading) return
    if (!user || user.isAnonymous) return
    if (!profile || profile.uid !== user.uid) return
    const action = consumePendingAuthAction(opts.source)
    if (!action) return
    void (action.kind === 'share' ? onShareRef.current() : onSaveRef.current())
  }, [opts.ready, opts.source, user, profile, loading])

  return pending
}
