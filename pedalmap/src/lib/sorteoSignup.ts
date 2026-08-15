const STORAGE_KEY = 'pedalmap_sorteo'

export function markSorteoSignup(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function isSorteoSignup(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function consumeSorteoSignup(): boolean {
  if (!isSorteoSignup()) return false
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode */
  }
  return true
}
