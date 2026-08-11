import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useJsonLd } from '@/hooks/useJsonLd'
import { webPageJsonLd } from '@/lib/jsonLd'

export interface SeoPageContent {
  path: string
  title: string
  description: string
  heading: string
  body: string[]
  related?: Array<{ to: string; label: string }>
}

export function SeoContentPage({ content }: { content: SeoPageContent }) {
  usePageMeta({
    title: content.title,
    description: content.description,
    path: content.path,
  })
  useJsonLd(
    `seo-${content.path}`,
    webPageJsonLd({
      path: content.path,
      name: content.heading,
      description: content.description,
    }),
  )

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24 md:px-6">
      <p className="font-display text-sm font-bold tracking-wide text-[var(--color-trail)]">
        Pedal<span className="text-[var(--color-forest)]">Map</span>
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-[var(--color-forest)]">
        {content.heading}
      </h1>
      <div className="mt-6 space-y-4 text-[var(--color-stone)] leading-relaxed">
        {content.body.map((p) => (
          <p key={p.slice(0, 48)}>{p}</p>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/route-planner">
          <Button>Abrir planificador</Button>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center text-sm font-semibold text-[var(--color-forest)] underline-offset-4 hover:underline"
        >
          Qué es PedalMap
        </Link>
      </div>
      {content.related && content.related.length > 0 && (
        <nav className="mt-12 border-t border-[var(--color-fog)] pt-6" aria-label="Guías relacionadas">
          <h2 className="font-display text-lg font-bold text-[var(--color-forest)]">
            Sigue explorando
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {content.related.map((item) => (
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
