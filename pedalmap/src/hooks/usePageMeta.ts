import { useEffect } from 'react'
import { canonicalSiteUrl, SITE_ORIGIN } from '@/lib/siteConfig'

interface PageMeta {
  title: string
  description: string
  path: string
  image?: string
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

export function usePageMeta({ title, description, path, image }: PageMeta) {
  useEffect(() => {
    const url = canonicalSiteUrl(path)
    const ogImage = image?.startsWith('http')
      ? image
      : image
        ? canonicalSiteUrl(image)
        : `${SITE_ORIGIN}/brand/logo-horizontal.png`
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:image', ogImage)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertCanonical(url)
  }, [title, description, path, image])
}
