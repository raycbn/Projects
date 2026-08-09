import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'

export interface SeoPageContent {
  path: string
  title: string
  description: string
  heading: string
  body: string[]
}

export function SeoContentPage({ content }: { content: SeoPageContent }) {
  usePageMeta({
    title: content.title,
    description: content.description,
    path: content.path,
  })

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-trail)]">
        PedalMap
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-[var(--color-forest)]">
        {content.heading}
      </h1>
      <div className="mt-6 space-y-4 text-[var(--color-stone)] leading-relaxed">
        {content.body.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
      <Link to="/route-planner" className="mt-8 inline-block">
        <Button>Abrir planificador</Button>
      </Link>
    </main>
  )
}
