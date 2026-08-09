export function createShareSlug(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ruta'

  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export async function shareUrl(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url, text: title })
      return 'shared'
    } catch {
      // fall through to clipboard
    }
  }
  const ok = await copyToClipboard(url)
  return ok ? 'copied' : 'failed'
}
