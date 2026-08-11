/**
 * Serializes Firebase Auth sign-in calls so anonymous warm-up cannot overwrite
 * a concurrent email/Google login (which bounced users back to /login).
 */
let chain: Promise<unknown> = Promise.resolve()

export function withAuthLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
