import { Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useJsonLd } from '@/hooks/useJsonLd'
import { webPageJsonLd } from '@/lib/jsonLd'
import { blogPosts } from '@/content/blogPosts'

export function BlogIndexPage() {
  usePageMeta({
    title: 'Blog ciclista | PedalMap',
    description:
      'Guías prácticas: GPX a Garmin/Wahoo, Objetivo circular, viento, desnivel y cómo planificar rutas en España con PedalMap.',
    path: '/blog',
  })
  useJsonLd(
    'blog-index',
    webPageJsonLd({
      path: '/blog',
      name: 'Blog PedalMap',
      description: 'Guías prácticas de planificación ciclista',
    }),
  )

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24 md:px-6">
      <p className="font-display text-sm font-bold tracking-wide text-[var(--color-trail)]">
        Pedal<span className="text-[var(--color-forest)]">Map</span>
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-[var(--color-forest)]">Blog</h1>
      <p className="mt-3 text-[var(--color-stone)]">
        Tutoriales cortos para crear rutas, exportar GPX y salir con datos de verdad.
      </p>
      <ul className="mt-10 space-y-6">
        {blogPosts.map((post) => (
          <li key={post.slug} className="border-b border-[var(--color-fog)] pb-6">
            <p className="text-xs text-[var(--color-stone)]">
              {post.date} · {post.readMinutes} min · {post.tags.join(' · ')}
            </p>
            <Link
              to={`/blog/${post.slug}`}
              className="mt-1 block font-display text-2xl font-bold text-[var(--color-forest)] hover:text-[var(--color-trail)]"
            >
              {post.title}
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{post.description}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
