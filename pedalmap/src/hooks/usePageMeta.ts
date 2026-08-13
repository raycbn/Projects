import { useEffect } from 'react'
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from '@/lib/site'

interface PageMeta {
  title: string
  description: string
  path: string
  image?: string
  /** Open Graph type — use article for blog posts. */
  ogType?: 'website' | 'article'
  /** When true, ask crawlers not to index (private/app routes). */
  noindex?: boolean
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

export function usePageMeta({
  title,
  description,
  path,
  image,
  ogType = 'website',
  noindex = false,
}: PageMeta) {
  useEffect(() => {
    const url = absoluteUrl(path)
    const ogImage = image || DEFAULT_OG_IMAGE
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow')
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:type', ogType)
    upsertMeta('property', 'og:locale', 'es_ES')
    upsertMeta('property', 'og:image', ogImage)
    upsertMeta('property', 'og:image:width', '1200')
    upsertMeta('property', 'og:image:height', '630')
    upsertMeta('property', 'og:image:alt', title)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', ogImage)
    upsertCanonical(url)
  }, [title, description, path, image, ogType, noindex])
}
