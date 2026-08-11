import { Link, Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useJsonLd } from '@/hooks/useJsonLd'
import { getPostBySlug } from '@/content/blogPosts'
import { SITE_ORIGIN } from '@/lib/site'

export function BlogPostPage() {
  const { slug = '' } = useParams()
  const post = getPostBySlug(slug)

  usePageMeta({
    title: post ? `${post.title} | PedalMap` : 'Artículo | PedalMap',
    description: post?.description || 'Guía PedalMap',
    path: post ? `/blog/${post.slug}` : '/blog',
  })

  useJsonLd(
    `blog-${slug}`,
    post
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.date,
          author: { '@type': 'Organization', name: 'PedalMap' },
          publisher: {
            '@type': 'Organization',
            name: 'PedalMap',
            url: SITE_ORIGIN,
          },
          mainEntityOfPage: `${SITE_ORIGIN}/blog/${post.slug}`,
          inLanguage: 'es-ES',
        }
      : { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Blog' },
  )

  if (!post) return <Navigate to="/blog" replace />

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24 md:px-6">
      <p className="text-xs text-[var(--color-stone)]">
        <Link to="/blog" className="font-semibold text-[var(--color-trail)] hover:underline">
          Blog
        </Link>
        {' · '}
        {post.date} · {post.readMinutes} min
      </p>
      <h1 className="mt-3 font-display text-4xl font-extrabold text-[var(--color-forest)]">
        {post.title}
      </h1>
      <div className="mt-6 space-y-4 text-[var(--color-stone)] leading-relaxed">
        {post.body.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>
      <div className="mt-8">
        <Link to="/route-planner">
          <Button>Abrir planificador</Button>
        </Link>
      </div>
      {post.relatedPaths && post.relatedPaths.length > 0 && (
        <nav className="mt-12 border-t border-[var(--color-fog)] pt-6" aria-label="Relacionado">
          <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">Sigue leyendo</h2>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {post.relatedPaths.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="font-medium text-[var(--color-trail)] underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  )
}
