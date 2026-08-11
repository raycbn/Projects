import { Link, Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { RichText } from '@/components/blog/RichText'
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
        {post.date} · {post.readMinutes} min · {post.tags.join(' · ')}
      </p>
      <h1 className="mt-3 font-display text-4xl font-extrabold text-[var(--color-forest)]">
        {post.title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-[var(--color-stone)]">
        <RichText text={post.lead} />
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to={post.primaryCta.to}>
          <Button>{post.primaryCta.label}</Button>
        </Link>
        {post.secondaryCtas?.map((cta) => (
          <Link
            key={cta.to}
            to={cta.to}
            className="inline-flex items-center text-sm font-semibold text-[var(--color-forest)] underline-offset-4 hover:underline"
          >
            {cta.label}
          </Link>
        ))}
      </div>

      <div className="mt-10 space-y-4 text-[var(--color-stone)] leading-relaxed">
        {post.blocks.map((block, i) =>
          block.type === 'h2' ? (
            <h2
              key={`h-${i}-${block.text.slice(0, 24)}`}
              className="pt-4 font-display text-2xl font-bold text-[var(--color-forest)]"
            >
              {block.text}
            </h2>
          ) : (
            <p key={`p-${i}-${block.text.slice(0, 24)}`}>
              <RichText text={block.text} />
            </p>
          ),
        )}
      </div>

      <div className="mt-10 rounded-2xl bg-[color-mix(in_oklab,var(--color-mist)_65%,white)] p-5 ring-1 ring-[var(--color-fog)]">
        <p className="font-display text-lg font-bold text-[var(--color-forest)]">Ponlo en práctica</p>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          Abre la herramienta de PedalMap que corresponde a esta guía:
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={post.primaryCta.to}>
            <Button>{post.primaryCta.label}</Button>
          </Link>
          {post.secondaryCtas?.slice(0, 2).map((cta) => (
            <Link key={cta.to} to={cta.to}>
              <Button variant="secondary">{cta.label}</Button>
            </Link>
          ))}
        </div>
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
